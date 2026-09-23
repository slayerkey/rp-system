using System.Text;

namespace PackRat.HWiNFOBridge;

public static class SelfTest
{
    public static int Run()
    {
        try
        {
            TestV2UnicodeAndUnits();
            TestLegacyLayout();
            TestMalformedLayout();
            TestLargeCatalogAndDuplicates();
            TestSemanticFingerprintSurvivesIdChanges();
            Console.WriteLine("PACKRAT HWINFO BRIDGE SELF-TEST PASS");
            return 0;
        }
        catch (Exception error)
        {
            Console.Error.WriteLine("PACKRAT HWINFO BRIDGE SELF-TEST FAIL: " + error);
            return 1;
        }
    }

    private static void TestV2UnicodeAndUnits()
    {
        var rows = new[]
        {
            new FixtureReading(10,0,100,"CPU [#0]: AMD Ryzen","CPU [#0]: AMD Ryzen","CPU Temp","CPU 温度","°C","Temperature",67.25,31.5,81.75,56.2),
            new FixtureReading(20,1,200,"Board Sensor","主板 センサー 🎮","Pump Temperature","ポンプ温度 gyqp","°C","Temperature",42.5,30,49,39.2),
            new FixtureReading(20,1,201,"Board Sensor","主板 センサー 🎮","Pump Speed","ポンプ速度","RPM","Fan",2450,2300,2600,2475)
        };
        var parsed = HWiNFOParser.Parse(BuildV2(rows, pollTime:1_800_000_000));
        Require(parsed.Sensors.Count==3,"v2 reading count");
        Require(parsed.Sensors[1].SensorName=="主板 センサー 🎮","UTF-8 sensor name");
        Require(parsed.Sensors[1].Label=="ポンプ温度 gyqp","UTF-8 reading label");
        Require(parsed.Sensors[1].Unit=="°C","UTF-8 exact unit");
        Require(parsed.Sensors[2].Type=="Fan","reading type");
        Require(parsed.Sensors[0].Value==67.25,"current value");
        Require(parsed.Sensors[0].Min==31.5 && parsed.Sensors[0].Max==81.75 && parsed.Sensors[0].Avg==56.2,"native statistics");
    }

    private static void TestLegacyLayout()
    {
        var rows = new[] { new FixtureReading(3,0,9,"Legacy CPU","Legacy CPU","Core Clock","Core Clock","MHz","Clock",5125,600,5300,4120) };
        var parsed=HWiNFOParser.Parse(BuildLegacy(rows, pollTime:1_800_000_001));
        Require(parsed.Sensors.Count==1,"legacy reading count");
        Require(parsed.Sensors[0].SensorName=="Legacy CPU","legacy sensor name");
        Require(parsed.Sensors[0].Unit=="MHz","legacy unit");
    }

    private static void TestMalformedLayout()
    {
        var bytes=BuildV2(new[]{new FixtureReading(1,0,1,"CPU","CPU","Temp","Temp","°C","Temperature",50,40,60,50)},1_800_000_002);
        WriteU32(bytes,24,1);
        var failed=false;
        try{HWiNFOParser.Parse(bytes);}catch(InvalidDataException){failed=true;}
        Require(failed,"malformed sensor row must fail closed");

        bytes=BuildV2(new[]{new FixtureReading(1,0,1,"CPU","CPU","Temp","Temp","°C","Temperature",double.NaN,40,60,50)},1_800_000_003);
        var parsed=HWiNFOParser.Parse(bytes);
        Require(parsed.Sensors.Count==1 && !parsed.Sensors[0].Available && parsed.Sensors[0].Value is null,"NaN must be unavailable, never zero");
    }

    private static void TestLargeCatalogAndDuplicates()
    {
        var rows=new List<FixtureReading>();
        for(var i=0;i<140;i++) rows.Add(new FixtureReading((uint)(i/7+1),(uint)(i%2),(uint)(1000+i),"Device "+(i/7),"Device "+(i/7),"Sensor "+i,"Sensor "+i,"W","Power",i+0.5,0,i+1,i/2.0));
        rows.Add(new FixtureReading(900,0,9000,"Duplicate","Duplicate","Temperature","Temperature","°C","Temperature",40,30,50,39));
        rows.Add(new FixtureReading(901,0,9000,"Duplicate","Duplicate","Temperature","Temperature","°C","Temperature",41,30,51,40));
        var parsed=HWiNFOParser.Parse(BuildV2(rows.ToArray(),1_800_000_004));
        Require(parsed.Sensors.Count==142,"100+ sensor catalog");
        var dups=parsed.Sensors.Where(x=>x.SensorName=="Duplicate").ToArray();
        Require(dups.Length==2 && dups[0].Fingerprint!=dups[1].Fingerprint,"duplicate semantic names require unique fingerprints");
    }

    private static void TestSemanticFingerprintSurvivesIdChanges()
    {
        var first=HWiNFOParser.Parse(BuildV2(new[]{new FixtureReading(10,0,100,"GPU","GPU","Hot Spot","Hot Spot","°C","Temperature",70,30,90,60)},1_800_000_005)).Sensors.Single();
        var second=HWiNFOParser.Parse(BuildV2(new[]{new FixtureReading(999,0,555,"GPU","GPU","Hot Spot","Hot Spot","°C","Temperature",71,30,91,61)},1_800_000_006)).Sensors.Single();
        Require(first.Key!=second.Key,"raw ids changed in fixture");
        Require(first.Fingerprint==second.Fingerprint,"semantic fingerprint should survive sensor id changes between machines");
    }

    private static byte[] BuildV2(FixtureReading[] readings,long pollTime) => Build(readings,pollTime,2,392,460);
    private static byte[] BuildLegacy(FixtureReading[] readings,long pollTime) => Build(readings,pollTime,1,264,316);

    private static byte[] Build(FixtureReading[] readings,long pollTime,uint version,int sensorSize,int readingSize)
    {
        var sensors=readings.GroupBy(r=>(r.SensorId,r.SensorInstance,r.SensorOriginal,r.SensorDisplay)).Select(g=>g.Key).ToArray();
        var sensorOffset=48;
        var readingOffset=sensorOffset+sensorSize*sensors.Length;
        var bytes=new byte[readingOffset+readingSize*readings.Length];
        WriteU32(bytes,0,HWiNFOSharedMemorySource.ActiveSignature);
        WriteU32(bytes,4,version);WriteU32(bytes,8,1);WriteI64(bytes,12,pollTime);
        WriteU32(bytes,20,(uint)sensorOffset);WriteU32(bytes,24,(uint)sensorSize);WriteU32(bytes,28,(uint)sensors.Length);
        WriteU32(bytes,32,(uint)readingOffset);WriteU32(bytes,36,(uint)readingSize);WriteU32(bytes,40,(uint)readings.Length);WriteU32(bytes,44,1000);

        for(var i=0;i<sensors.Length;i++)
        {
            var s=sensors[i];var o=sensorOffset+i*sensorSize;
            WriteU32(bytes,o,s.SensorId);WriteU32(bytes,o+4,s.SensorInstance);
            WriteString(bytes,o+8,128,s.SensorOriginal,Encoding.UTF8);WriteString(bytes,o+136,128,s.SensorDisplay,Encoding.UTF8);
            if(version>=2)WriteString(bytes,o+264,128,s.SensorDisplay,Encoding.UTF8);
        }

        for(var i=0;i<readings.Length;i++)
        {
            var r=readings[i];var o=readingOffset+i*readingSize;
            var sensorIndex=Array.FindIndex(sensors,s=>s.SensorId==r.SensorId&&s.SensorInstance==r.SensorInstance&&s.SensorOriginal==r.SensorOriginal&&s.SensorDisplay==r.SensorDisplay);
            WriteU32(bytes,o,TypeValue(r.Type));WriteU32(bytes,o+4,(uint)sensorIndex);WriteU32(bytes,o+8,r.ReadingId);
            WriteString(bytes,o+12,128,r.LabelOriginal,Encoding.UTF8);WriteString(bytes,o+140,128,r.LabelDisplay,Encoding.UTF8);WriteString(bytes,o+268,16,r.Unit,Encoding.UTF8);
            WriteF64(bytes,o+284,r.Value);WriteF64(bytes,o+292,r.Min);WriteF64(bytes,o+300,r.Max);WriteF64(bytes,o+308,r.Avg);
            if(version>=2){WriteString(bytes,o+316,128,r.LabelDisplay,Encoding.UTF8);WriteString(bytes,o+444,16,r.Unit,Encoding.UTF8);}
        }
        return bytes;
    }

    private static uint TypeValue(string type)=>type switch{"Temperature"=>1u,"Voltage"=>2u,"Fan"=>3u,"Current"=>4u,"Power"=>5u,"Clock"=>6u,"Usage"=>7u,_=>8u};
    private static void WriteString(byte[] bytes,int offset,int length,string value,Encoding encoding){var encoded=encoding.GetBytes(value);Array.Copy(encoded,0,bytes,offset,Math.Min(length-1,encoded.Length));}
    private static void WriteU32(byte[] bytes,int offset,uint value)=>BitConverter.GetBytes(value).CopyTo(bytes,offset);
    private static void WriteI64(byte[] bytes,int offset,long value)=>BitConverter.GetBytes(value).CopyTo(bytes,offset);
    private static void WriteF64(byte[] bytes,int offset,double value)=>BitConverter.GetBytes(value).CopyTo(bytes,offset);
    private static void Require(bool condition,string message){if(!condition)throw new InvalidOperationException(message);}

    private sealed record FixtureReading(uint SensorId,uint SensorInstance,uint ReadingId,string SensorOriginal,string SensorDisplay,string LabelOriginal,string LabelDisplay,string Unit,string Type,double Value,double Min,double Max,double Avg);
}
