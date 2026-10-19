// Khameleon's own input helper for macOS (Capture full recording - docs/build-review.md, Build 4).
// Our code, using only Apple's Accessibility and Quartz Event APIs (no third-party libraries).
//
//   khameleon-input check            -> {"accessibility":bool,"inputMonitoring":bool}
//   khameleon-input record           -> one JSON line per action (click / type / key / secure)
//   khameleon-input replay '<json>'  -> {"ok":bool,"message":"..."}
//   khameleon-input dump <App>       -> the named elements Khameleon can see in an app
//
// Safeguards: typing into a password field is never recorded (a "secure" line says only that it
// happened); steps name UI elements (role + label), never screen positions; replay finds the named
// element or reports that it couldn't - it never guesses.

import Foundation
import AppKit
import ApplicationServices

func emit(_ obj: [String: Any]) {
    if let data = try? JSONSerialization.data(withJSONObject: obj), let s = String(data: data, encoding: .utf8) {
        FileHandle.standardOutput.write((s + "\n").data(using: .utf8)!)
    }
}

func attr(_ el: AXUIElement, _ name: String) -> AnyObject? {
    var v: AnyObject?
    return AXUIElementCopyAttributeValue(el, name as CFString, &v) == .success ? v : nil
}
func str(_ el: AXUIElement, _ name: String) -> String {
    (attr(el, name) as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
}
func label(_ el: AXUIElement) -> String {
    for a in [kAXTitleAttribute, kAXDescriptionAttribute, "AXPlaceholderValue", kAXHelpAttribute, kAXIdentifierAttribute] {
        let s = str(el, a as String)
        if !s.isEmpty { return String(s.prefix(80)) }
    }
    // A text field's label often lives in a sibling/title element.
    if let t = attr(el, kAXTitleUIElementAttribute as String) { let s = str(t as! AXUIElement, kAXValueAttribute as String); if !s.isEmpty { return String(s.prefix(80)) } }
    return ""
}
func role(_ el: AXUIElement) -> String { str(el, kAXRoleAttribute as String) }
func isSecure(_ el: AXUIElement) -> Bool {
    role(el) == "AXSecureTextField" || str(el, kAXSubroleAttribute as String) == "AXSecureTextField"
}
func parent(_ el: AXUIElement) -> AXUIElement? {
    guard let p = attr(el, kAXParentAttribute as String) else { return nil }
    return (p as! AXUIElement)
}

let interesting: Set<String> = ["AXButton", "AXTextField", "AXTextArea", "AXSecureTextField", "AXCheckBox", "AXRadioButton", "AXPopUpButton", "AXComboBox", "AXMenuItem", "AXMenuButton", "AXLink", "AXTab", "AXCell", "AXRow", "AXSearchField", "AXDisclosureTriangle", "AXSlider", "AXIncrementor"]

/// The meaningful element at or above the one hit (a button's text -> the button).
func meaningful(_ start: AXUIElement) -> AXUIElement {
    var el: AXUIElement? = start
    var depth = 0
    while let e = el, depth < 6 {
        if interesting.contains(role(e)) { return e }
        el = parent(e); depth += 1
    }
    return start
}

func appInfo(_ el: AXUIElement) -> (name: String, pid: pid_t, window: String) {
    var pid: pid_t = 0
    AXUIElementGetPid(el, &pid)
    let name = NSRunningApplication(processIdentifier: pid)?.localizedName ?? ""
    var window = ""
    if let w = attr(el, kAXWindowAttribute as String) { window = str(w as! AXUIElement, kAXTitleAttribute as String) }
    return (name, pid, window)
}

func isOwnApp(_ name: String) -> Bool { name == "Electron" || name.hasPrefix("Khameleon") }

// MARK: - check

func check() {
    emit(["accessibility": AXIsProcessTrusted(), "inputMonitoring": CGPreflightListenEventAccess()])
}

// MARK: - record

let systemWide = AXUIElementCreateSystemWide()
var typing: (el: AXUIElement, text: String, app: String, window: String, role: String, label: String, before: String?)? = nil

/// What was typed or pasted: the field's text afterwards minus what was there before. Pure.
func inserted(before: String, after: String) -> String {
    let b = Array(before), a = Array(after)
    var start = 0
    while start < b.count && start < a.count && b[start] == a[start] { start += 1 }
    var endB = b.count, endA = a.count
    while endB > start && endA > start && b[endB - 1] == a[endA - 1] { endB -= 1; endA -= 1 }
    return String(a[start..<endA])
}
var lastKeyTime = Date()
var secureReported = false

func flushTyping() {
    guard let t = typing else { return }
    typing = nil
    // Prefer the field's real contents (exact, and catches pasting); fall back to the keys seen.
    var text = t.text
    if let before = t.before, let after = attr(t.el, kAXValueAttribute as String) as? String {
        let diff = inserted(before: before, after: after)
        if !diff.isEmpty { text = diff }
    }
    if text.isEmpty { return }
    emit(["type": "type", "app": t.app, "window": t.window, "role": t.role, "label": t.label, "text": text, "at": Date().timeIntervalSince1970])
}

/// The focused element of the frontmost app (not system-wide, which can report Khameleon's overlay).
func focused() -> AXUIElement? {
    guard let front = NSWorkspace.shared.frontmostApplication, !isOwnApp(front.localizedName ?? "") else { return nil }
    guard let f = attr(AXUIElementCreateApplication(front.processIdentifier), kAXFocusedUIElementAttribute as String) else { return nil }
    return (f as! AXUIElement)
}

/// The app owning the topmost window at a point, skipping Khameleon's own windows (the overlay
/// covers the whole screen, so the system-wide hit test would always find it).
func appUnder(_ point: CGPoint) -> pid_t? {
    guard let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] else { return nil }
    for w in list { // front to back
        guard let pid = w[kCGWindowOwnerPID as String] as? pid_t, (w[kCGWindowLayer as String] as? Int ?? 0) == 0,
              let b = w[kCGWindowBounds as String] as? [String: CGFloat] else { continue }
        let rect = CGRect(x: b["X"] ?? 0, y: b["Y"] ?? 0, width: b["Width"] ?? 0, height: b["Height"] ?? 0)
        guard rect.contains(point) else { continue }
        if isOwnApp(NSRunningApplication(processIdentifier: pid)?.localizedName ?? "") { continue }
        return pid
    }
    return nil
}

/// What a click at this point would record (also used by the "probe" command).
func describeClick(_ point: CGPoint) -> [String: Any]? {
    guard let pid = appUnder(point) else { return nil }
    var hit: AXUIElement?
    guard AXUIElementCopyElementAtPosition(AXUIElementCreateApplication(pid), Float(point.x), Float(point.y), &hit) == .success, let h = hit else { return nil }
    let el = meaningful(h)
    let info = appInfo(el)
    if isOwnApp(info.name) { return nil }
    return ["type": "click", "app": info.name, "window": info.window, "role": role(el), "label": label(el), "at": Date().timeIntervalSince1970]
}

func handleClick(_ point: CGPoint) {
    flushTyping()
    if let d = describeClick(point) { emit(d) }
}

func handleKey(_ event: CGEvent) {
    guard let el = focused() else { return }
    let info = appInfo(el)
    if isOwnApp(info.name) { return }
    if isSecure(el) {
        flushTyping()
        if !secureReported { emit(["type": "secure", "app": info.name, "window": info.window, "label": label(el), "at": Date().timeIntervalSince1970]); secureReported = true }
        return
    }
    secureReported = false
    let code = event.getIntegerValueField(.keyboardEventKeycode)
    let named: [Int64: String] = [36: "return", 48: "tab", 53: "escape", 76: "enter"]
    if let k = named[code] {
        flushTyping()
        emit(["type": "key", "key": k, "app": info.name, "window": info.window, "at": Date().timeIntervalSince1970])
        return
    }
    if event.flags.contains(.maskCommand) || event.flags.contains(.maskControl) { return } // shortcuts aren't text
    var len = 0
    var chars = [UniChar](repeating: 0, count: 8)
    event.keyboardGetUnicodeString(maxStringLength: 8, actualStringLength: &len, unicodeString: &chars)
    let s = String(utf16CodeUnits: chars, count: len)
    if code == 51 { // delete
        if typing != nil, !typing!.text.isEmpty { typing!.text.removeLast() }
        return
    }
    if s.isEmpty || s.unicodeScalars.contains(where: { CharacterSet.controlCharacters.contains($0) }) { return }
    if let t = typing, CFEqual(t.el, el) { typing!.text += s }
    else {
        flushTyping()
        // The field's text just before this first key (the key itself hasn't landed yet).
        typing = (el, s, info.name, info.window, role(el), label(el), attr(el, kAXValueAttribute as String) as? String)
    }
    lastKeyTime = Date()
}

func record() {
    let mask = (1 << CGEventType.leftMouseDown.rawValue) | (1 << CGEventType.keyDown.rawValue)
    let callback: CGEventTapCallBack = { _, type, event, _ in
        if type == .leftMouseDown { handleClick(event.location) }
        else if type == .keyDown { handleKey(event) }
        return Unmanaged.passUnretained(event)
    }
    guard let tap = CGEvent.tapCreate(tap: .cgSessionEventTap, place: .headInsertEventTap, options: .listenOnly, eventsOfInterest: CGEventMask(mask), callback: callback, userInfo: nil) else {
        emit(["type": "error", "message": "Khameleon isn't allowed to watch the mouse and keyboard yet (Input Monitoring / Accessibility in System Settings)."])
        exit(2)
    }
    let source = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0)
    CFRunLoopAddSource(CFRunLoopGetCurrent(), source, .commonModes)
    CGEvent.tapEnable(tap: tap, enable: true)
    emit(["type": "ready", "inputMonitoring": CGPreflightListenEventAccess()])
    // Typing is sent as one step once the user pauses.
    Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { _ in
        if typing != nil && Date().timeIntervalSince(lastKeyTime) > 1.5 { flushTyping() }
    }
    signal(SIGTERM) { _ in flushTyping(); exit(0) }
    signal(SIGINT) { _ in flushTyping(); exit(0) }
    CFRunLoopRun()
}

// MARK: - replay

func children(_ el: AXUIElement) -> [AXUIElement] {
    (attr(el, kAXChildrenAttribute as String) as? [AXUIElement]) ?? []
}

/// Breadth-first search of the app's windows for an element with this role and label.
func find(in app: AXUIElement, role wantRole: String, label wantLabel: String, window wantWindow: String) -> AXUIElement? {
    let deadline = Date().addingTimeInterval(4)
    var windows = (attr(app, kAXWindowsAttribute as String) as? [AXUIElement]) ?? []
    if !wantWindow.isEmpty, let w = windows.first(where: { str($0, kAXTitleAttribute as String) == wantWindow }) { windows = [w] + windows.filter { !CFEqual($0, w) } }
    let want = wantLabel.lowercased()
    var queue = windows
    var seen = 0
    var loose: AXUIElement? = nil
    while !queue.isEmpty && Date() < deadline && seen < 20000 {
        let el = queue.removeFirst(); seen += 1
        let r = role(el), l = label(el).lowercased()
        if r == wantRole && !want.isEmpty && l == want { return el }
        if loose == nil && r == wantRole && !want.isEmpty && l.contains(want) { loose = el }
        queue.append(contentsOf: children(el))
    }
    return loose
}

func keyPress(_ code: CGKeyCode) {
    let src = CGEventSource(stateID: .hidSystemState)
    CGEvent(keyboardEventSource: src, virtualKey: code, keyDown: true)?.post(tap: .cghidEventTap)
    CGEvent(keyboardEventSource: src, virtualKey: code, keyDown: false)?.post(tap: .cghidEventTap)
}
func typeText(_ s: String) {
    let src = CGEventSource(stateID: .hidSystemState)
    for u in s.utf16 {
        var c = u
        let down = CGEvent(keyboardEventSource: src, virtualKey: 0, keyDown: true); down?.keyboardSetUnicodeString(stringLength: 1, unicodeString: &c); down?.post(tap: .cghidEventTap)
        let up = CGEvent(keyboardEventSource: src, virtualKey: 0, keyDown: false); up?.keyboardSetUnicodeString(stringLength: 1, unicodeString: &c); up?.post(tap: .cghidEventTap)
        usleep(8000)
    }
}

func replay(_ json: String) {
    guard let data = json.data(using: .utf8), let step = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
        emit(["ok": false, "message": "That step couldn't be read."]); return
    }
    let appName = step["app"] as? String ?? ""
    let kind = step["type"] as? String ?? ""
    guard let running = NSWorkspace.shared.runningApplications.first(where: { $0.localizedName == appName }) else {
        emit(["ok": false, "message": "\(appName) isn't open."]); return
    }
    running.activate()
    usleep(400000)
    if kind == "key" {
        let codes: [String: CGKeyCode] = ["return": 36, "tab": 48, "escape": 53, "enter": 76]
        if let c = codes[step["key"] as? String ?? ""] { keyPress(c); emit(["ok": true, "message": "Pressed \(step["key"] as? String ?? "")."]) }
        else { emit(["ok": false, "message": "Unknown key."]) }
        return
    }
    let app = AXUIElementCreateApplication(running.processIdentifier)
    let wantRole = step["role"] as? String ?? ""
    let wantLabel = step["label"] as? String ?? ""
    if wantLabel.isEmpty {
        emit(["ok": false, "found": false, "message": "This step has no named target in \(appName), so Khameleon won't guess where to act."]); return
    }
    guard let el = find(in: app, role: wantRole, label: wantLabel, window: step["window"] as? String ?? "") else {
        emit(["ok": false, "found": false, "message": "Couldn't find \"\(wantLabel)\" in \(appName)."]); return
    }
    if kind == "click" {
        let r = AXUIElementPerformAction(el, kAXPressAction as CFString)
        if r == .success { emit(["ok": true, "message": "Clicked \"\(wantLabel)\" in \(appName)."]) }
        else { emit(["ok": false, "found": true, "message": "Found \"\(wantLabel)\" in \(appName) but couldn't press it."]) }
        return
    }
    if kind == "type" {
        let text = step["text"] as? String ?? ""
        AXUIElementSetAttributeValue(el, kAXFocusedAttribute as CFString, kCFBooleanTrue)
        usleep(150000)
        if AXUIElementSetAttributeValue(el, kAXValueAttribute as CFString, text as CFString) != .success { typeText(text) }
        emit(["ok": true, "message": "Typed into \"\(wantLabel)\" in \(appName)."]); return
    }
    emit(["ok": false, "message": "Unknown step."])
}

// MARK: - dump (what Khameleon can see in an app - for checking a recording will replay)

func dump(_ appName: String) {
    guard let running = NSWorkspace.shared.runningApplications.first(where: { $0.localizedName == appName }) else { emit(["ok": false, "message": "\(appName) isn't open."]); return }
    let app = AXUIElementCreateApplication(running.processIdentifier)
    var queue = (attr(app, kAXWindowsAttribute as String) as? [AXUIElement]) ?? []
    var out: [[String: String]] = []
    while !queue.isEmpty && out.count < 400 {
        let el = queue.removeFirst()
        let r = role(el)
        if interesting.contains(r) {
            var item = ["role": r, "label": label(el)]
            if let pv = attr(el, kAXPositionAttribute as String), let sv = attr(el, kAXSizeAttribute as String) {
                var p = CGPoint.zero, z = CGSize.zero
                AXValueGetValue(pv as! AXValue, .cgPoint, &p); AXValueGetValue(sv as! AXValue, .cgSize, &z)
                item["center"] = "\(Int(p.x + z.width / 2)),\(Int(p.y + z.height / 2))"
            }
            out.append(item)
        }
        queue.append(contentsOf: children(el))
    }
    emit(["ok": true, "elements": out])
}

// MARK: - main

let args = CommandLine.arguments
switch args.count > 1 ? args[1] : "" {
case "check": check()
case "record": record()
case "replay": replay(args.count > 2 ? args[2] : "")
case "dump": dump(args.count > 2 ? args[2] : "")
case "probe": // what a click at x,y would record
    if args.count > 3, let x = Double(args[2]), let y = Double(args[3]), let d = describeClick(CGPoint(x: x, y: y)) { emit(d) } else { emit(["ok": false, "message": "Nothing named there."]) }
default: emit(["ok": false, "message": "usage: khameleon-input check|record|replay '<step json>'"])
}
