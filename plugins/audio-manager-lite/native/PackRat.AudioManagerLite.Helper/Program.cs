using System.Text;
using System.Text.Json;
using PackRat.AudioCore;

Console.InputEncoding=Encoding.UTF8;Console.OutputEncoding=Encoding.UTF8;
var json=new JsonSerializerOptions(JsonSerializerDefaults.Web);
if(args.Contains("--self-test",StringComparer.OrdinalIgnoreCase)){Console.WriteLine(JsonSerializer.Serialize(new Response("self-test",true,"SUCCESS",null,null),json));return 0;}
if(!OperatingSystem.IsWindows()){Console.Error.WriteLine("Audio Manager Lite helper requires Windows.");return 2;}
var audio=new WindowsAudioSystem();string? line;
while((line=Console.ReadLine()) is not null){
 if(string.IsNullOrWhiteSpace(line))continue;
 Response response;string id="";
 try{
  using var doc=JsonDocument.Parse(line);var root=doc.RootElement;id=Optional(root,"id");var command=Required(root,"command");
  if(command=="snapshot"){var s=audio.Read();response=new(id,s.Error is null,s.Error is null?"SUCCESS":"FAILED",s,s.Error);}
  else if(command=="set-default-output"){
   var endpointId=RequiredOpaque(root,"endpointId");audio.SetDefault(AudioFlowKind.Output,AudioDefaultRole.Default,endpointId);var s=audio.Read();
   var ok=s.Error is null&&s.DefaultOutputId==endpointId&&s.MultimediaOutputId==endpointId;
   response=new(id,ok,ok?"SUCCESS":"FAILED",s,ok?null:"Windows did not verify the output switch.");
  } else throw new ArgumentException("Unknown helper command.");
 }catch(Exception e){response=new(id,false,"FAILED",null,Sanitize(e));}
 Console.WriteLine(JsonSerializer.Serialize(response,json));Console.Out.Flush();
}
return 0;
static string Required(JsonElement r,string n){if(!r.TryGetProperty(n,out var v)||v.ValueKind!=JsonValueKind.String)throw new ArgumentException($"Missing {n}.");var s=(v.GetString()??"").Trim();if(s.Length is 0 or >4096)throw new ArgumentException($"Invalid {n}.");return s;}
static string RequiredOpaque(JsonElement r,string n){if(!r.TryGetProperty(n,out var v)||v.ValueKind!=JsonValueKind.String)throw new ArgumentException($"Missing {n}.");var s=v.GetString()??"";if(s.Length is 0 or >4096)throw new ArgumentException($"Invalid {n}.");return s;}
static string Optional(JsonElement r,string n)=>r.TryGetProperty(n,out var v)&&v.ValueKind==JsonValueKind.String?(v.GetString()??""):"";
static string Sanitize(Exception e){var s=e.Message;return s.Length>220?s[..220]:s;}
public sealed record Response(string Id,bool Ok,string Status,AudioSystemSnapshot? Snapshot,string? Error);
