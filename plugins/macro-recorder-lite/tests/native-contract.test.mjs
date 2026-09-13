import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root=new URL("../",import.meta.url);
const repoRoot=new URL("../../",root);

test("native input host keeps Macro Recorder release-safety invariants",async()=>{
  const [cs,hostJs,buildHost]=await Promise.all([
    readFile(new URL("shared/windows-input/PackRat.InputHost/Program.cs",repoRoot),"utf8"),
    readFile(new URL("shared/macro-recorder/input-host.mjs",repoRoot),"utf8"),
    readFile(new URL("shared/windows-input/build-host.mjs",repoRoot),"utf8")
  ]);

  const recover=cs.indexOf("engine.RecoverBeforeHooks();");
  const hooks=cs.indexOf("engine.StartHooks();");
  assert.ok(recover>=0&&hooks>recover,"stale held input must be recovered before hooks start");

  assert.match(cs,/record HeldKey\(int Vk, int Scan, bool Extended\)/);
  assert.match(cs,/keys = keys\.Select\(key => new \{ vk = key\.Vk, scan = key\.Scan, extended = key\.Extended \}\)/);
  assert.match(cs,/Native\.SendKey\(key\.Vk, key\.Scan, true, key\.Extended\)/);

  assert.match(cs,/ev\.DelayMs = \(int\)Math\.Clamp\(now - _lastEventMs, 0, _maxDurationMs\)/);
  assert.match(cs,/data\.vkCode == Native\.VK_F12[\s\S]*IsPlaybackActive\(\)/);

  assert.match(buildHost,/--self-contained","true"/);
  assert.match(buildHost,/LOCALAPPDATA/);
  assert.match(buildHost,/dotnet-install\.ps1/);
  assert.match(buildHost,/"-Channel","8\.0"/);

  assert.match(hostJs,/--parent-pid/);
  assert.match(hostJs,/String\(process\.pid\)/);
  assert.match(cs,/ReadArgInt\(args, "--parent-pid"\)/);
  assert.match(cs,/parent\.WaitForExitAsync\(\)/);

  assert.match(cs,/FileShare\.None/);
  assert.match(cs,/macro-recorder-session\.lock/);
  assert.match(cs,/EnsureFamilySessionOwnedLocked\(\)/);
  assert.match(cs,/RecoverStuckInputOwned\(\)/);

  assert.match(cs,/AddHeldKeyBeforeInjection\(key\);[\s\S]*Native\.SendKey\(key\.Vk, key\.Scan, false, key\.Extended\)/);
  assert.match(cs,/AddHeldButtonBeforeInjection\(button\);[\s\S]*Native\.SendMouseButton\(button, false\)/);
  assert.match(cs,/File\.WriteAllText\(temp, JsonSerializer\.Serialize\(state\)\);[\s\S]*File\.Move\(temp, _recoveryFile, true\)/);

  assert.match(cs,/var sent = SendInput\(1, \[input\], Marshal\.SizeOf<INPUT>\(\)\);/);
  assert.match(cs,/if \(sent == 1\) return;/);
  assert.match(cs,/higher integrity level \(UIPI\)/);

  assert.doesNotMatch(cs,/keys\.Concat\(\[Native\.VK_SHIFT/);
  assert.doesNotMatch(cs,/foreach \(var button in new\[\] \{ "left", "right", "middle", "x1", "x2" \}\)/);
});

test("recovery journal only clears after release attempts and keeps an empty tombstone",async()=>{
  const cs=await readFile(new URL("shared/windows-input/PackRat.InputHost/Program.cs",repoRoot),"utf8");
  const release=cs.indexOf("private void ReleasePressed()");
  const persist=cs.indexOf("private void PersistHeldInputLocked()");
  const block=cs.slice(release,persist);

  assert.ok(block.indexOf("Native.SendKey") < block.indexOf("RemoveHeldKeyAfterSuccessfulRelease"));
  assert.ok(block.indexOf("Native.SendMouseButton") < block.indexOf("RemoveHeldButtonAfterSuccessfulRelease"));
  assert.match(cs,/The empty file is the durable tombstone/);
  assert.match(cs,/WriteRecoveryState\(failedKeys, failedButtons\)/);
});
