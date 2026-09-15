param(
  [Parameter(Mandatory=$true)]
  [ValidateSet("context","clipboard","focus","type","paste")]
  [string]$Mode
)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms

if (-not ("PackRatTextInput" -as [type])) {
Add-Type -TypeDefinition @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;

public static class PackRatTextInput {
    [StructLayout(LayoutKind.Sequential)]
    struct INPUT { public uint type; public InputUnion U; }
    [StructLayout(LayoutKind.Explicit)]
    struct InputUnion {
        [FieldOffset(0)] public MOUSEINPUT mi;
        [FieldOffset(0)] public KEYBDINPUT ki;
        [FieldOffset(0)] public HARDWAREINPUT hi;
    }
    [StructLayout(LayoutKind.Sequential)]
    struct MOUSEINPUT {
        public int dx;
        public int dy;
        public uint mouseData;
        public uint dwFlags;
        public uint time;
        public UIntPtr dwExtraInfo;
    }
    [StructLayout(LayoutKind.Sequential)]
    struct KEYBDINPUT {
        public ushort wVk;
        public ushort wScan;
        public uint dwFlags;
        public uint time;
        public UIntPtr dwExtraInfo;
    }
    [StructLayout(LayoutKind.Sequential)]
    struct HARDWAREINPUT {
        public uint uMsg;
        public ushort wParamL;
        public ushort wParamH;
    }

    const uint INPUT_KEYBOARD = 1;
    const uint KEYEVENTF_KEYUP = 0x0002;
    const uint KEYEVENTF_UNICODE = 0x0004;
    const ushort VK_CONTROL = 0x11;
    const ushort VK_V = 0x56;
    const ushort VK_RETURN = 0x0D;
    const ushort VK_TAB = 0x09;
    const ushort VK_LEFT = 0x25;

    [DllImport("user32.dll", SetLastError=true)]
    static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("kernel32.dll")]
    static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")]
    static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
    [DllImport("user32.dll")]
    static extern bool BringWindowToTop(IntPtr hWnd);
    [DllImport("user32.dll")]
    static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);

    public static int InputStructSize() {
        return Marshal.SizeOf(typeof(INPUT));
    }
    public static int ExpectedInputStructSize() {
        return IntPtr.Size == 8 ? 40 : 28;
    }
    static void Send(INPUT input) {
        var values = new INPUT[] { input };
        int size = Marshal.SizeOf(typeof(INPUT));
        if (size != ExpectedInputStructSize())
            throw new InvalidOperationException("Unexpected Win32 INPUT struct size: " + size);
        if (SendInput(1, values, size) != 1)
            throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    }
    static void VirtualKey(ushort vk, bool up) {
        var input = new INPUT();
        input.type = INPUT_KEYBOARD;
        input.U.ki.wVk = vk;
        input.U.ki.dwFlags = up ? KEYEVENTF_KEYUP : 0;
        Send(input);
    }
    static void Press(ushort vk) {
        VirtualKey(vk, false);
        VirtualKey(vk, true);
    }
    static void UnicodeChar(char value) {
        var down = new INPUT();
        down.type = INPUT_KEYBOARD;
        down.U.ki.wScan = value;
        down.U.ki.dwFlags = KEYEVENTF_UNICODE;
        Send(down);
        var up = down;
        up.U.ki.dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP;
        Send(up);
    }
    public static void TypeText(string value) {
        if (value == null) return;
        for (int i = 0; i < value.Length; i++) {
            char c = value[i];
            if (c == '\r') {
                if (i + 1 < value.Length && value[i + 1] == '\n') i++;
                UnicodeChar('\r');
            } else if (c == '\n') {
                UnicodeChar('\r');
            } else if (c == '\t') {
                UnicodeChar('\t');
            } else {
                UnicodeChar(c);
            }
        }
    }
    public static void Paste() {
        VirtualKey(VK_CONTROL, false);
        try {
            Press(VK_V);
        } finally {
            VirtualKey(VK_CONTROL, true);
        }
    }
    public static void CursorLeft(int count) {
        for (int i = 0; i < count; i++) Press(VK_LEFT);
    }
    public static void After(string action) {
        if (String.Equals(action, "tab", StringComparison.OrdinalIgnoreCase)) Press(VK_TAB);
        if (String.Equals(action, "enter", StringComparison.OrdinalIgnoreCase)) Press(VK_RETURN);
    }
    public static bool FocusWindow(IntPtr hWnd) {
        if (hWnd == IntPtr.Zero) return false;
        IntPtr foreground = GetForegroundWindow();
        uint ignored;
        uint foregroundThread = foreground == IntPtr.Zero ? 0 : GetWindowThreadProcessId(foreground, out ignored);
        uint targetThread = GetWindowThreadProcessId(hWnd, out ignored);
        uint currentThread = GetCurrentThreadId();
        bool attachedCurrent = false;
        bool attachedTarget = false;
        try {
            if (foregroundThread != 0 && currentThread != foregroundThread)
                attachedCurrent = AttachThreadInput(currentThread, foregroundThread, true);
            if (foregroundThread != 0 && targetThread != 0 && targetThread != foregroundThread)
                attachedTarget = AttachThreadInput(targetThread, foregroundThread, true);
            ShowWindowAsync(hWnd, 9);
            BringWindowToTop(hWnd);
            bool focused = SetForegroundWindow(hWnd);
            return focused || GetForegroundWindow() == hWnd;
        } finally {
            if (attachedTarget) AttachThreadInput(targetThread, foregroundThread, false);
            if (attachedCurrent) AttachThreadInput(currentThread, foregroundThread, false);
        }
    }
    public static string ForegroundProcessName() {
        IntPtr hwnd = GetForegroundWindow();
        if (hwnd == IntPtr.Zero) return "";
        uint pid;
        GetWindowThreadProcessId(hwnd, out pid);
        try { return Process.GetProcessById((int)pid).ProcessName ?? ""; }
        catch { return ""; }
    }
}
"@
}

$raw = [Console]::In.ReadToEnd()
$data = if ([string]::IsNullOrWhiteSpace($raw)) { [pscustomobject]@{} } else { $raw | ConvertFrom-Json }
function Emit($object) { $object | ConvertTo-Json -Compress -Depth 5 | Write-Output }
function DecodeText($value) {
  if ($null -eq $value) { return "" }
  return [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String([string]$value))
}
function Invoke-ClipboardRetry {
  param(
    [Parameter(Mandatory=$true)][scriptblock]$Operation,
    [int]$Attempts = 8,
    [int]$DelayMs = 40
  )
  for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
    try {
      return & $Operation
    }
    catch {
      if ($attempt -ge $Attempts) { throw }
      Start-Sleep -Milliseconds $DelayMs
    }
  }
}

switch ($Mode) {
  "context" {
    $hwnd = [PackRatTextInput]::GetForegroundWindow()
    Emit @{
      ok = $true
      hwnd = [string]$hwnd.ToInt64()
      app = [PackRatTextInput]::ForegroundProcessName()
      username = [Environment]::UserName
      computer = [Environment]::MachineName
      inputStructSize = [PackRatTextInput]::InputStructSize()
      expectedInputStructSize = [PackRatTextInput]::ExpectedInputStructSize()
    }
  }
  "clipboard" {
    $text = ""
    $containsText = Invoke-ClipboardRetry { [System.Windows.Forms.Clipboard]::ContainsText([System.Windows.Forms.TextDataFormat]::UnicodeText) }
    if ($containsText) {
      $text = Invoke-ClipboardRetry { [System.Windows.Forms.Clipboard]::GetText([System.Windows.Forms.TextDataFormat]::UnicodeText) }
    }
    Emit @{ ok=$true; text=$text }
  }
  "focus" {
    $hwnd = [IntPtr]([Int64]([string]$data.hwnd))
    $focused = if ($hwnd -eq [IntPtr]::Zero) { $false } else { [PackRatTextInput]::FocusWindow($hwnd) }
    Emit @{ ok=$true; focused=[bool]$focused }
  }
  "type" {
    $text = DecodeText $data.textB64
    [PackRatTextInput]::TypeText($text)
    $left = [Math]::Max(0, [int]$data.cursorBack)
    if ($left -gt 0) { [PackRatTextInput]::CursorLeft($left) }
    [PackRatTextInput]::After([string]$data.afterInsert)
    Emit @{ ok=$true; mode="unicode"; clipboardRestored=$true }
  }
  "paste" {
    $text = DecodeText $data.textB64
    $original = $null
    $hadOriginal = $false
    try {
      $original = Invoke-ClipboardRetry { [System.Windows.Forms.Clipboard]::GetDataObject() }
      $hadOriginal = $null -ne $original
    } catch {}
    $restored = $true
    try {
      Invoke-ClipboardRetry { [System.Windows.Forms.Clipboard]::SetText($text, [System.Windows.Forms.TextDataFormat]::UnicodeText) } | Out-Null
      [PackRatTextInput]::Paste()
      # Clipboard paste is asynchronous in many applications. Give large/multiline
      # payloads enough time to be consumed before restoring the previous clipboard.
      $pasteDelayMs = [Math]::Min(1200, [Math]::Max(180, 180 + [Math]::Ceiling($text.Length / 50.0)))
      Start-Sleep -Milliseconds ([int]$pasteDelayMs)
    } finally {
      try {
        if ($hadOriginal) {
          Invoke-ClipboardRetry { [System.Windows.Forms.Clipboard]::SetDataObject($original, $true) } | Out-Null
        } else {
          Invoke-ClipboardRetry { [System.Windows.Forms.Clipboard]::Clear() } | Out-Null
        }
      } catch {
        $restored = $false
      }
    }
    $left = [Math]::Max(0, [int]$data.cursorBack)
    if ($left -gt 0) { [PackRatTextInput]::CursorLeft($left) }
    [PackRatTextInput]::After([string]$data.afterInsert)
    Emit @{ ok=$true; mode="clipboard"; clipboardRestored=$restored }
  }
}
