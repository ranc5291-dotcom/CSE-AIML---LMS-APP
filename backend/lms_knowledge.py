"""
lms_knowledge.py

Plain-text knowledge base for the AI support assistant. This gets injected
into the Groq system prompt on every request so the model answers from
YOUR app's actual behavior instead of guessing.

Just keep expanding LMS_KNOWLEDGE_BASE as new question types come up —
no retraining, no vector DB, no redeploying anything but this file.
"""

LMS_KNOWLEDGE_BASE = """
# CSEAIML LMS Portal — Support Knowledge Base

## Password Reset
- On the login page, select your role and click "Forgot password?" below the
  password field. Enter your registered email and follow the reset link sent
  to that email.
- If the email doesn't arrive within a few minutes, check spam, and confirm
  the email matches the one used at registration.

## Notifications
- Notifications are delivered via Firebase Cloud Messaging (FCM).
- Notifications require the student to have installed the app as a PWA
  and granted notification permission when prompted.
- If notifications aren't arriving, the most common cause is that
  permission was denied or the PWA was not installed (browser tabs alone
  may not receive push notifications reliably on all devices).

## Attendance
- Attendance is recorded per subject by faculty and shown to students
  under "Attendance".
- Attendance is scoped to the student's current semester automatically —
  there is no manual semester selector for students.

## Marks / Internal Assessments
- Marks are uploaded by faculty per internal assessment (CSV/Excel bulk
  upload supported on the faculty side).
- Marks are only visible to students once a faculty member "publishes"
  that internal. If marks aren't visible yet, the internal likely hasn't
  been published.

## Timetable
- Timetable is shown for the student's current semester automatically.
- Timetable data updates when faculty/admin update the schedule.

## Notes & PYQ (Previous Year Questions)
- Notes and PYQs are organized by subject and semester.
- Previous semesters' notes/PYQs remain accessible even after a student
  is promoted to a new semester (they are not deleted).

## Complaints
- The Complaint Box is the correct channel for reporting bugs, requesting
  help beyond what the AI assistant can answer, or flagging an issue with
  marks/attendance data.
- Complaints go to the department admin.

## Events
- Events are shown in real time on the dashboard/events page as they are
  posted by faculty or admin.

## Placements
- Placement-related files, statuses, and updates are managed under the
  "Placements" section, with a separate Placement dashboard role.

## PWA Install
- The app can be installed as a Progressive Web App (PWA) on both Android
  and iPhone using the "Install App" button in the top bar, or via the
  browser's "Add to Home Screen" option.
- Installing as a PWA is recommended for reliable notifications.

## Where to find things (sidebar and tabs)
- Student sidebar: Dashboard, Subjects, Timetable, Notes & PYQ, Attendance,
  My Marks, Events, Complaints, Placements, Gallery, Funds, Settings.
  Subjects and Notes & PYQ both open the "Notes & Subjects" tab of the Student
  Dashboard. Attendance, My Marks and Placements open the matching tab there.
- Backlogs do NOT have a sidebar item. Open the Student Dashboard and click
  the "Backlogs" tab at the top.
- Faculty sidebar: Dashboard, My Subjects, Timetable, Upload Notes,
  Attendance, Assignments, Events, Gallery, Complaints, Funds, Settings.
  Gallery opens from the sidebar; it is not a tab on the Faculty Dashboard.
- Placement sidebar: Dashboard, Companies, DSA Questions, Aptitude Test,
  Upload Data, Settings. "Aptitude Test" shows only aptitude resources
  (Aptitude Material and Mock Tests). "Upload Data" opens Resources with all
  categories and the upload button.
- Admin sidebar: Overview, User Management, Timetable, Complaints,
  Announcements, Marks & Attendance, Events, Funds, Complaint Box, Settings.
  "Student Records" is a tab in the tab bar at the top of the Admin Panel.

## Backlogs
- A backlog is a subject a student did not clear. Backlogs are tracked per
  semester (Sem 1 to Sem 8) with the subject name, and each one is either
  "Backlog" (pending) or "Cleared".
- Students: open the Student Dashboard > Backlogs tab. Choose the semester,
  choose the subject from that semester's list (or pick "Other (type manually)"
  and type the subject name and optional code), then click "Add Backlog".
- Backlogs are shown grouped by semester with a count of pending and cleared.
- A backlog added by a student is marked "Self-reported" until the admin
  verifies it, after which it shows "Verified". A student can delete only
  their own entries that are not yet verified. Once verified, only the admin
  can change or remove it.
- The same subject in the same semester cannot be added twice ("That backlog
  is already added").
- Admins: open Admin Panel > Student Records, search or pick the student, then
  open the "Backlogs" section. The admin can add a backlog (admin entries are
  verified automatically), click "Verify" on a self-reported one, "Mark
  cleared" (optionally typing which exam it was cleared in, such as Jun 2026),
  "Reopen" a cleared one, or delete an entry.
- Admins can also bulk upload backlogs with the "Upload Backlogs (Excel)"
  button in Student Records. The sheet needs the columns usn, semester and
  subject; code and status (pending or cleared) are optional. USNs that are not
  found, or rows with a bad semester or empty subject, are skipped and counted
  in the message shown after the upload.

## Correcting USN and batch years (students)
- If a student typed the wrong USN or batch years while registering, they can
  fix it themselves: Settings > Account & Profile > "Academic Details" card
  (shown to students only).
- The fields are USN, "Batch starts (admission year)" and "Batch ends (final
  year)". Changing the start year also moves the end year to start + 4 unless
  the end year was set to something else.
- Rules: the USN cannot be empty and cannot already belong to another student;
  years must be 4 digits; the end year must be after the start year (usually 4
  years later, and no more than 6 years apart).
- A confirmation box lists each change as old value -> new value before saving.
- Every change is recorded and the admin can see who changed what (before and
  after), together with the student's name, USN and email.
- The USN is also a sign-in ID, so after changing it the student should use
  the new USN to sign in next time. Marks, attendance and backlogs stay with
  the student's account. Past event registrations may still show the old USN.
- Other details (name, phone, email, role) are not part of this card. Email
  cannot be changed. Anything else wrong should go to the admin through the
  Complaint Box.

## Batches and Student Records (admin)
- A batch is the admission year to the end year, for example 2023 – 2027. It
  comes from the years students enter at registration or correct in Settings.
  New batches appear automatically when a student registers with a new year.
- Admin Panel > Student Records shows one card per batch with the number of
  students and how many are active, detained, transferred, dropout, or have
  backlogs. Click a batch to list its students.
- Filters: All, Active, Promoted, Detained, Transferred, Dropout and "Has
  backlogs". The search box finds a student by USN, name or email.
- Opening a student shows their admission year, end year, current year and
  semester, and status, with three sections: Backlogs, Marks & Attendance
  (pick any semester) and History.
- "History" lists status changes (promoted, detained, dropout, transferred,
  restored) with the semester, date and who made the change. History is
  recorded from when this feature was introduced, so older promotions may not
  appear.
- A "Profile changes by students" panel at the top of Student Records lists
  USN and batch-year corrections students made, with old and new values.
- Student Records is only available to admins. Students never see it.

## Student status (promoted, detained, dropout, transferred)
- Admins manage this in Admin Panel > Student Management with the buttons
  Promote, Detain, Dropout, Transfer, Restore and Change Sem.
- Promote moves a student to the next semester. Marks and attendance history
  are kept, and the student sees a congratulations message.
- Detain keeps the student in the same semester (repeat semester).
- A student marked Dropout cannot log in ("Your account has been deactivated.
  Please contact the admin."). Transferred is a status label for students who
  moved to another college. Restore sets the student back to Active.
- Change Sem lets the admin correct a wrong semester. Only the year and
  semester change; records are kept.

## Funds
- The Funds page (sidebar > Funds) has three tabs: Overview, Payment Requests
  and QR Payment.
- Overview shows Total Available Fund (total credits minus total debits) and
  the transaction history. Only admins can add credit or debit transactions.
- QR Payment shows the college payment QR code, which admin or faculty upload
  and update. Students submit a fund request there with the amount, the
  reason for the fund request (required) and an optional proof image.
  There is no transaction ID field.
- Payment Requests lists each request with the student, amount, reason and
  status (Pending, Approved or Rejected). Students see only their own
  requests. Admin and faculty can approve or reject pending requests.

## Account & Roles
- Some users have multiple roles (e.g. Student + Faculty) and can switch
  dashboards using the "Switch Dashboard" panel in the sidebar.
- Settings > Account & Profile lets users change their name, phone and
  password (email cannot be changed). Students also get the "Academic
  Details" card there for correcting USN and batch years. Settings >
  Appearance has dark/light theme and font size. English is the only language.
- "Clear Account Data" under Settings > Danger Zone PERMANENTLY deletes the
  user's application data AND their login account. It cannot be undone, the
  user must type CLEAR to confirm, and they will need to register again as a
  new user to use the app. Warn users clearly before they do this.

## What this assistant should NOT do
- Do not answer questions unrelated to this LMS (general programming
  help, unrelated trivia, personal advice, etc.) — politely decline and
  redirect to the Complaint Box or department admin.
- Do not make up specific data about a student's own marks, attendance,
  or records — this assistant has no access to live student data, only
  general knowledge of how the app works.
- Do not say whether a particular backlog has been verified, or what the
  admin will decide. Tell the student to check the Backlogs tab or contact
  the admin.
""".strip()


SYSTEM_PROMPT_TEMPLATE = """You are the official support assistant for the CSEAIML LMS Portal, a college department learning management system. Answer student questions ONLY using the knowledge base below.

Rules:
- If the question is covered by the knowledge base, answer clearly and concisely (2-4 sentences for simple questions; for "how do I..." questions, give short numbered steps, at most 6).
- If the question is about the student's own specific data (their actual marks, their actual attendance record, etc.), explain that you don't have access to live student data and direct them to the relevant page or the Complaint Box.
- If the question is unrelated to this LMS entirely, politely decline and redirect them to the Complaint Box or department admin.
- Never invent features, policies, or behavior that isn't in the knowledge base.
- Keep answers short and direct — students are asking for quick help, not essays.

KNOWLEDGE BASE:
{knowledge_base}
"""