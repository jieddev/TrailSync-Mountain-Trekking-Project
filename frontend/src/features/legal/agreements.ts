// Must match CURRENT_TERMS_VERSION and CURRENT_WAIVER_VERSION in
// backend/src/lib/agreements.ts; the API rejects any other version. Bump both
// whenever the text of that agreement changes.
export const TERMS_VERSION = '2026-10-30'
export const WAIVER_VERSION = '2026-10-30'

export type AgreementId = 'terms' | 'privacy' | 'waiver'

export type AgreementSection = {
  heading: string
  paragraphs: string[]
}

export type Agreement = {
  title: string
  version: string
  sections: AgreementSection[]
}

// DRAFT TEXT for client review. Items in [brackets] are not decided yet and
// must be filled in by the Barangay Cabintan tourism office before launch.
export const agreements: Record<AgreementId, Agreement> = {
  terms: {
    title: 'Terms of Use',
    version: TERMS_VERSION,
    sections: [
      {
        heading: 'About TrailSync',
        paragraphs: [
          'TrailSync is the booking and trail management system for trekking in Barangay Cabintan, Ormoc City, Leyte. It is operated by [the Barangay Cabintan tourism office].',
          'By creating an account you agree to these Terms of Use. If you do not agree, do not create an account.',
        ],
      },
      {
        heading: 'Your account',
        paragraphs: [
          'Give your real name and a working email address. Keep your password private; you are responsible for what is done with your account.',
          'You may use TrailSync only to plan and book treks for yourself and the people in your group.',
        ],
      },
      {
        heading: 'Bookings',
        paragraphs: [
          'A booking is a request. It is confirmed only after a tourism coordinator reviews it and verifies the downpayment.',
          'Prices, downpayments, group limits, and trail availability are set by the tourism office and shown when you book. Trails may be closed for weather or safety, and bookings on closed dates are not accepted.',
          'Your guide is assigned by the tourism office at check-in. You cannot choose a guide.',
        ],
      },
      {
        heading: 'Conduct on the trail',
        paragraphs: [
          'Each booking requires agreeing to the Trek Waiver and Trail Rules. The tourism office may refuse check-in or end a trek when those rules are not followed.',
        ],
      },
      {
        heading: 'Changes to these terms',
        paragraphs: [
          'We may update these terms. When we do, we will show the new version and may ask you to agree again.',
          'Questions: [tourism office contact email / phone].',
        ],
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    version: TERMS_VERSION,
    sections: [
      {
        heading: 'Why we collect your information',
        paragraphs: [
          'We process personal information under the Data Privacy Act of 2012 (Republic Act No. 10173) only to manage trek bookings, keep groups safe on the trail, issue completion certificates, and keep tourism records for the barangay.',
        ],
      },
      {
        heading: 'What we collect',
        paragraphs: [
          'Account: your full name and email address.',
          'Bookings: the name, age, and address of each participant, and an optional email for their certificate.',
          "During a trek: the location of the assigned guide's phone, which represents the group. TrailSync does not track each hiker's own device.",
          'Safety records: incident and SOS reports made during a trek.',
        ],
      },
      {
        heading: 'Who can see it',
        paragraphs: [
          'Tourism coordinators of [the Barangay Cabintan tourism office] and the guide assigned to your group. We do not sell your information or share it for advertising.',
          'We may share information with emergency responders or authorities when needed to protect life or safety, or when required by law.',
        ],
      },
      {
        heading: 'How long we keep it',
        paragraphs: [
          'We keep booking and trek records for [retention period], then delete or anonymize them. Anonymized totals may be kept for tourism statistics.',
        ],
      },
      {
        heading: 'Your rights',
        paragraphs: [
          'You may ask to see, correct, or delete your personal information, or object to its processing, by contacting [Data Protection Officer name and email]. You may also file a complaint with the National Privacy Commission.',
        ],
      },
      {
        heading: 'Information about other people',
        paragraphs: [
          'When you add participants to a booking, you confirm that they (or, for minors, their parent or guardian) agreed to share their information for that booking.',
        ],
      },
    ],
  },
  waiver: {
    title: 'Trek Waiver and Trail Rules',
    version: WAIVER_VERSION,
    sections: [
      {
        heading: 'Risks of mountain trekking',
        paragraphs: [
          'Trekking involves risks including slips and falls, uneven and muddy ground, insect bites, heat, sudden weather changes, and being far from medical help. Every participant joins voluntarily and accepts these risks.',
        ],
      },
      {
        heading: 'Health and fitness',
        paragraphs: [
          'Each participant is in suitable health for the trek and has told the guide about any medical condition, allergy, or medicine that matters on the trail.',
        ],
      },
      {
        heading: 'Follow your guide',
        paragraphs: [
          "Stay with your group and follow the guide's instructions at all times. Do not leave the trail or go ahead of the guide.",
          'The guide or tourism office may change the route, turn the group back, or end the trek for weather or safety.',
        ],
      },
      {
        heading: 'Respect the trail',
        paragraphs: [
          'Bring back all your trash. Do not pick plants, disturb wildlife, or make fires. Respect the local community and other groups on the trail.',
        ],
      },
      {
        heading: 'Booking and payment',
        paragraphs: [
          'The booking is confirmed only after the coordinator verifies the downpayment shown on the booking form.',
          'Groups check in on the scheduled date. A group arriving on another day must reschedule first.',
          'Refunds and no-shows: [policy to be set by the tourism office].',
        ],
      },
      {
        heading: 'Agreeing for your group',
        paragraphs: [
          'As the person making this booking, you confirm that every participant has read and agreed to these rules, and that a parent or guardian agrees for each participant under 18 and will be responsible for them on the trek.',
          '[Liability wording to be reviewed by the tourism office or its legal adviser.]',
        ],
      },
    ],
  },
}
