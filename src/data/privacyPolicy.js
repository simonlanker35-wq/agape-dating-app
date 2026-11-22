// The privacy policy shown under Me → Settings → Privacy policy. Plain text, one entry per section;
// a line starting with "• " is shown as a bullet. Keep PRIVACY_UPDATED current when anything changes.
export const PRIVACY_UPDATED = "November 2026";

export const PRIVACY_POLICY = [
  {
    title: "Who is responsible",
    body: [
      "Agape is run by Simon Lanker, Marktstrasse 30, 6436 Muotathal, Switzerland. Email: agape_dating@outlook.com.",
      "This policy explains which personal data Agape processes, why, with whom it is shared, how long it is kept and what rights you have. It follows the Swiss Federal Act on Data Protection (FADP).",
    ],
  },
  {
    title: "What we collect",
    body: [
      "• Account: your phone number and/or email address, and your password (stored only in scrambled form).",
      "• Profile: first name, age, gender, height, photos, voice answers, prompts, interests, values, goals, lifestyle details, job, school and what you are here for (dating, friends or both).",
      "• Faith: your denomination and anything about your faith you write in your profile.",
      "• Location: the town you enter or, if you allow it, your device's location. Other members only see the town and a rounded distance.",
      "• Activity: likes, Doves, comments, matches, messages, photos and voice notes in chats, date plans and feedback, community posts, blocks and reports.",
      "• Verification: verification photos you send. Once approved they appear on your profile as verified photos.",
      "• Payments: your Agape+ plan and its status. Card details go directly to Stripe; we never see them.",
      "• Technical and usage data: device and browser type, IP address, app version, and how the app is used (see \"What is recorded\").",
    ],
  },
  {
    title: "Your religious beliefs",
    body: [
      "Your religious beliefs are especially sensitive personal data. We only process them because you agreed to it when you signed up, and only to show your denomination on your profile and to match you with people who share your faith.",
      "You can withdraw this consent at any time by deleting your account under Me → Settings → Delete account. Your religious information is then deleted together with the rest of your account.",
    ],
  },
  {
    title: "What is recorded",
    body: [
      "• Your consent: we record the date and time you agreed to the processing of your religious beliefs, and which version of the consent text you saw.",
      "• App usage: we record how the app is used with PostHog, including screen recordings of sessions, to find bugs and improve Agape. Everything you type and all chat content is hidden in these recordings.",
      "• Safety: reports, blocks and the action we took on them are recorded so we can protect members.",
      "We do not record phone or video calls.",
    ],
  },
  {
    title: "Why we use your data",
    body: [
      "• To run Agape: your account, your profile, matching, chats, dates and the community.",
      "• To keep members safe: verification, reports, blocks and removing accounts that break the guidelines.",
      "• To handle Agape+ payments and invitations.",
      "• To send you codes, emails and notifications you asked for.",
      "• To find bugs and improve the app.",
      "We do not sell your data and do not use it for advertising.",
    ],
  },
  {
    title: "Who we share it with",
    body: [
      "Other members see what is on your profile and what you send them. Besides that, these providers process data on our behalf:",
      "• Supabase: database, login and file storage (EU).",
      "• PostHog: usage statistics and session recordings (EU).",
      "• Stripe: payments (Ireland and USA).",
      "• Twilio: SMS codes for phone sign-in (USA).",
      "• Resend: account emails such as password resets (USA).",
      "• Render: hosting of the Agape website (USA).",
      "• Google: only if you choose \"Continue with Google\" (USA).",
      "• Apple, Google, Microsoft and Mozilla: delivery of push notifications to your device (USA).",
      "• OpenStreetMap: town search when you enter a place (United Kingdom).",
      "The USA does not in general offer data protection equal to Switzerland's. We only use providers there that are certified under the Swiss-U.S. Data Privacy Framework or have agreed to standard contractual clauses recognised by the Swiss Federal Data Protection and Information Commissioner (FDPIC).",
    ],
  },
  {
    title: "How long we keep it",
    body: [
      "• Your account, profile, photos, messages and consent record: as long as your account exists. When you delete your account they are deleted right away; backups are cleared within 30 days.",
      "• Messages and likes you sent to others are deleted with your account.",
      "• Reports and blocks you were involved in: up to 2 years, for the safety of other members.",
      "• Payment records: 10 years, as Swiss accounting law requires.",
      "• Usage statistics: up to 12 months. Session recordings: up to 30 days.",
      "• Technical logs: at most 90 days.",
    ],
  },
  {
    title: "Your rights",
    body: [
      "• Access: ask which data we have about you and get a copy.",
      "• Correction: correct wrong data. Most of it you can change yourself in the app.",
      "• Deletion: delete your account in the app at any time, or ask us to delete specific data.",
      "• Data portability: receive the data you gave us in a common electronic format.",
      "• Withdraw consent: by deleting your account (see \"Your religious beliefs\").",
      "• Object: object to processing based on our legitimate interests, such as usage statistics.",
      "Write to agape_dating@outlook.com. We answer within 30 days and may ask you to confirm your identity. You can also complain to the Federal Data Protection and Information Commissioner (FDPIC), Feldeggweg 1, 3003 Bern, www.edoeb.admin.ch.",
    ],
  },
  {
    title: "Security and age",
    body: [
      "All connections are encrypted. Database rules make sure members only see what is meant for them, and passwords are never stored in readable form.",
      "Agape is only for people aged 18 and over. We delete accounts of anyone younger.",
    ],
  },
  {
    title: "Changes",
    body: [
      "If we change this policy in an important way, we will tell you in the app. If a change affects your consent, we will ask you again.",
    ],
  },
];
