using Microsoft.Win32;

namespace PackRat.SmartLighting;

public static class CompanionInstall {
    const string RunValueName="PackRat Smart Lighting Companion";

    public static string InstallPath => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "PackRat","SmartLightingControl","PackRat-Lighting-Companion.exe");

    public static object Status(){
        var current=Environment.ProcessPath??"";
        var installed=File.Exists(InstallPath);
        var runningInstalled=installed&&SamePath(current,InstallPath);
        var startup=false;
        if(OperatingSystem.IsWindows()){
            try{
                using var key=Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run");
                startup=key?.GetValue(RunValueName) is string value&&value.Contains(InstallPath,StringComparison.OrdinalIgnoreCase);
            }catch{}
        }
        return new{installed,runningInstalled,startWithWindows=startup,installPath=InstallPath};
    }

    public static object Install(){
        if(!OperatingSystem.IsWindows())throw new PlatformNotSupportedException("Windows is required.");
        var source=Environment.ProcessPath;
        if(string.IsNullOrWhiteSpace(source)||!File.Exists(source))throw new InvalidOperationException("Could not locate the running companion executable.");
        Directory.CreateDirectory(Path.GetDirectoryName(InstallPath)!);
        if(!SamePath(source,InstallPath))File.Copy(source,InstallPath,true);
        SetStartup(true);
        return Status();
    }

    public static object SetStartup(bool enabled){
        if(!OperatingSystem.IsWindows())throw new PlatformNotSupportedException("Windows is required.");
        using var key=Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run",true)
            ??throw new InvalidOperationException("Could not open the Windows startup registry key.");
        if(enabled){
            if(!File.Exists(InstallPath))throw new InvalidOperationException("Install the companion locally before enabling Windows startup.");
            key.SetValue(RunValueName,$"\"{InstallPath}\" --no-browser",RegistryValueKind.String);
        }else key.DeleteValue(RunValueName,false);
        return Status();
    }

    static bool SamePath(string a,string b){
        try{return Path.GetFullPath(a).Equals(Path.GetFullPath(b),StringComparison.OrdinalIgnoreCase);}
        catch{return false;}
    }
}
