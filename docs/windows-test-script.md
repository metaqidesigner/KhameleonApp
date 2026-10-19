# Testing Khameleon on Windows

A step-by-step check of Khameleon on a real Windows PC. It takes about an hour, plus download time. You don't need to be technical: follow each step, and tick **Worked** or write what happened instead. Send the filled-in table at the end (and any screenshots) back to Newton.

**What you need**

- A Windows 10 or 11 PC you can install software on, with about 10 GB free space.
- **Docker Desktop** (free for small organisations and personal use, from docker.com). This runs the Khameleon server on the same PC.
- The Khameleon download from Newton: **Khameleon Setup 0.1.0.exe**. It's built automatically on GitHub: Actions → "khameleon-shell (Windows)" → the latest green run → *khameleon-windows-installer* at the bottom of the page.

Use a **test** email account and test files. Don't use real client data for this test.

---

## Part 1 - Set up

**1. Start the Khameleon server**

1. Install and open Docker Desktop. Wait until it says it's running.
2. Get the Khameleon folder from Newton (or GitHub) and open it.
3. Copy `.env.example` to a new file called `.env` and open it in Notepad. Fill in:
   - `KHAMELEON_ENCRYPTION_KEY=` a long random password (at least 32 characters). **Keep a copy somewhere safe.**
   - `POSTGRES_PASSWORD=` any password.
   - `KHAMELEON_APP_PASSWORD=` the password you'll sign in to Khameleon with - **delete the `#` at the start of that line** so it counts. (Needed because the server runs inside Docker.)
4. In the folder, click the address bar, type `cmd` and press Enter. In the black window type `docker compose up -d` and press Enter. The first time takes a few minutes.
5. Open **http://localhost:4001** in your browser. **Expected:** a Khameleon sign-in page.

**2. Install the desktop app**

1. Run **Khameleon Setup 0.1.0.exe**.
2. **Expected:** Windows shows a blue "Windows protected your PC" warning, because the app isn't signed yet. Click **More info → Run anyway**. *(Note it if your antivirus blocks or quarantines it - that's useful to know.)*
3. Finish the installer. Khameleon opens.

**3. First look**

1. **Expected:** a small Khameleon head in the bottom-right corner of the screen, on top of your other windows. You can still click everything else on the screen normally.
2. Sign in with the password from step 1.3 if asked.
3. Press **Ctrl+Shift+K**. **Expected:** the overlay hides; press again and it comes back.
4. Right-click the head. **Expected:** a menu with **Open Classic window**. Open it. **Expected:** the full Khameleon window appears. Close it again.
5. If you have two screens: move the mouse to the other screen and wait. **Expected:** the head follows.

**4. Set up Khami (Khameleon's own AI)**

1. **Expected:** a card saying **"Set up Khami?"**. Accept it. The download is a few GB, so it may take a while.
2. Click the head to open the chat and ask: *"What can you help me with?"* **Expected:** an answer labelled as by Khami.
3. Turn off Wi-Fi and ask another question. **Expected:** Khami still answers. Turn Wi-Fi back on.

---

## Part 2 - Working in your other apps

**5. Opening and closing apps**

1. In the chat, type: *"Open Notepad"*. **Expected:** Notepad opens, and Khameleon says it's done.
2. Type: *"Close Notepad"*. **Expected:** Notepad closes. (If it asks to save, that's normal.)
3. If you have Microsoft Office, try *"Open Excel"* and *"Open Word"*.
4. Try an app that isn't installed, e.g. *"Open Photoshop"*. **Expected:** Khameleon says it **couldn't** open it. It must **not** say it did.

**6. Finding files**

1. Put a test file called `test invoice.txt` in your Documents folder.
2. Ask: *"Find my files called invoice"*. **Expected:** it lists the file.

**7. The window border**

1. While Khameleon is opening or working in an app (step 5), watch the app's window. **Expected:** a coloured, softly pulsing border appears around it while Khameleon is looking at or working in it, and goes away afterwards. Note whether it lines up with the window's edges.

---

## Part 3 - Features to check

**8. Capture (recording a task as a skill)**

1. Open the toolbar on the left edge and choose **Capture**. Start recording, switch between Notepad and your browser a few times, then stop.
2. **Expected:** a note says the click-and-typing recorder **isn't available on Windows yet**, so only the windows you used are recorded. Then a written-up skill appears for you to check and save.
3. If Windows asks about screen recording or privacy permissions, note exactly what it says.

**9. Saved logins (Khameleon typing a login for you)**

1. Open **Settings → Credentials**. Add a login: name *Test login*, user name `tester`, password `not-a-real-password`.
2. Open **Notepad** and click inside it (it stands in for a website's sign-in page).
3. In the chat, ask Khameleon to sign in with *Test login*. **Expected:** it asks **"Use your Test login login?"** with **Once / Always for this skill / No**. Choose **Once**.
4. **Expected:** Notepad shows `tester`, then a Tab gap, then the password. The password must **not** appear anywhere in the chat.
5. Try again and choose **No**. **Expected:** nothing is typed, and Khameleon says it stopped.

**10. Spot tasks I repeat**

1. Open **Settings → Detection** and switch on **Spot tasks I repeat**. Also switch on **Also watch what's in the window**.
2. **Expected:** a **"Watching for tasks"** sign appears with a **Pause** button.
3. Open a banking website (just the home page). **Expected:** it isn't logged (it's on the default list of things left out).
4. Click **Delete my history**. **Expected:** it confirms the history is deleted.
5. Switch both off again.

**11. Email (only if Newton has set up Microsoft sign-in)**

1. Open **Settings → Microsoft sign-in** and connect the **test** Outlook account.
2. Ask the chat: *"Check my inbox"*. **Expected:** a short list of recent emails.
3. Open an email and choose **Help with this email**. **Expected:** a summary and a suggested reply. **Use this reply** saves it as a **draft** in Outlook. **Nothing is sent.**
4. Without a Microsoft connection, reading the email open in the Outlook desktop app is **Mac-only for now**. Note it if Khameleon says something unclear.

**12. Licences**

1. Open the Classic window → **About Khameleon → Licences → All third-party licences**. **Expected:** a long list opens.

**13. Uninstall**

1. **Settings → Apps → Khameleon → Uninstall**. **Expected:** it uninstalls cleanly. The server in Docker keeps your test data (`docker compose down -v` in the folder deletes it).

---

## Results

| Step | Worked? | What happened instead / notes |
|---|---|---|
| 1. Server starts, sign-in page | | |
| 2. Installer (warning, antivirus?) | | |
| 3. Head, click-through, Ctrl+Shift+K, Classic, two screens | | |
| 4. Khami download, answers, works offline | | |
| 5. Open/close Notepad, Office, missing app honest | | |
| 6. Find a file | | |
| 7. Window border lines up | | |
| 8. Capture (windows only) | | |
| 9. Saved login typed; password never shown; "No" stops | | |
| 10. Detection sign, banking left out, delete history | | |
| 11. Email (if connected) | | |
| 12. Licences list | | |
| 13. Uninstall | | |

**Also tell Newton:** your Windows version (Start → Settings → System → About), whether you have one or two screens and their scaling (e.g. 125%), any antivirus or company security software, and anything that felt slow, confusing or broken.
