using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace PackRat.SmartLighting;

public sealed class LocalConfig {
    public string? HueBridgeIp { get; set; }
    public string? HueBridgeId { get; set; }
    public string? HueCertificateSha256 { get; set; }
    public HashSet<string> Favorites { get; set; } = new(StringComparer.Ordinal);
}
public sealed class LocalState {
    readonly string directory;
    readonly string configPath;
    public LocalConfig Config { get; private set; }
    public LocalState() {
        directory=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"PackRat","SmartLightingControl");
        Directory.CreateDirectory(directory);
        configPath=Path.Combine(directory,"config.json");
        Config=Load();
    }
    LocalConfig Load() {
        try { return File.Exists(configPath) ? JsonSerializer.Deserialize<LocalConfig>(File.ReadAllText(configPath),JsonDefaults.Options) ?? new() : new(); }
        catch { return new(); }
    }
    public void Save() {
        var tmp=configPath+".tmp";
        File.WriteAllText(tmp,JsonSerializer.Serialize(Config,new JsonSerializerOptions(JsonDefaults.Options){WriteIndented=true}));
        File.Move(tmp,configPath,true);
    }
    public bool ToggleFavorite(string id,bool value) {
        if(value)Config.Favorites.Add(id);else Config.Favorites.Remove(id);Save();return value;
    }
    public string PairingToken() {
        var current=WindowsCredentialStore.Read("PackRat.SmartLighting.PairingToken");
        if(!string.IsNullOrWhiteSpace(current))return current;
        var raw=RandomNumberGenerator.GetBytes(18);
        current=Convert.ToBase64String(raw).TrimEnd('=').Replace('+','-').Replace('/','_');
        WindowsCredentialStore.Write("PackRat.SmartLighting.PairingToken",current);
        return current;
    }
    public string? HueAppKey()=>WindowsCredentialStore.Read("PackRat.SmartLighting.HueAppKey");
    public void SetHueAppKey(string value)=>WindowsCredentialStore.Write("PackRat.SmartLighting.HueAppKey",value);
    public string? GoveeApiKey()=>WindowsCredentialStore.Read("PackRat.SmartLighting.GoveeApiKey");
    public void SetGoveeApiKey(string? value){if(string.IsNullOrWhiteSpace(value))WindowsCredentialStore.Delete("PackRat.SmartLighting.GoveeApiKey");else WindowsCredentialStore.Write("PackRat.SmartLighting.GoveeApiKey",value.Trim());}
}

public static class WindowsCredentialStore {
    const int CRED_TYPE_GENERIC=1,CRED_PERSIST_LOCAL_MACHINE=2;
    [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]
    struct CREDENTIAL {
        public int Flags,Type;
        public string? TargetName,Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public int CredentialBlobSize;
        public IntPtr CredentialBlob;
        public int Persist,AttributeCount;
        public IntPtr Attributes;
        public string? TargetAlias,UserName;
    }
    [DllImport("advapi32.dll",EntryPoint="CredWriteW",CharSet=CharSet.Unicode,SetLastError=true)]
    static extern bool CredWrite(ref CREDENTIAL credential,uint flags);
    [DllImport("advapi32.dll",EntryPoint="CredReadW",CharSet=CharSet.Unicode,SetLastError=true)]
    static extern bool CredRead(string target,int type,int flags,out IntPtr credentialPtr);
    [DllImport("advapi32.dll",EntryPoint="CredDeleteW",CharSet=CharSet.Unicode,SetLastError=true)]
    static extern bool CredDelete(string target,int type,int flags);
    [DllImport("advapi32.dll")] static extern void CredFree(IntPtr buffer);

    public static void Write(string target,string secret) {
        if(!OperatingSystem.IsWindows())throw new PlatformNotSupportedException("Windows Credential Manager required");
        var ptr=Marshal.StringToCoTaskMemUni(secret);
        try{
            var c=new CREDENTIAL{Type=CRED_TYPE_GENERIC,TargetName=target,CredentialBlob=ptr,CredentialBlobSize=Encoding.Unicode.GetByteCount(secret),Persist=CRED_PERSIST_LOCAL_MACHINE,UserName="PackRat"};
            if(!CredWrite(ref c,0))throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
        } finally { Marshal.ZeroFreeCoTaskMemUnicode(ptr); }
    }
    public static string? Read(string target) {
        if(!OperatingSystem.IsWindows())return null;
        if(!CredRead(target,CRED_TYPE_GENERIC,0,out var ptr))return null;
        try{
            var c=Marshal.PtrToStructure<CREDENTIAL>(ptr);
            if(c.CredentialBlob==IntPtr.Zero||c.CredentialBlobSize<=0)return "";
            return Marshal.PtrToStringUni(c.CredentialBlob,c.CredentialBlobSize/2);
        } finally { CredFree(ptr); }
    }
    public static void Delete(string target) {
        if(OperatingSystem.IsWindows())CredDelete(target,CRED_TYPE_GENERIC,0);
    }
}
