
export type PB101EmailDay = 0 | 2 | 4 | 6 | 9;

export type PB101EmailTemplate = {
  day: PB101EmailDay;
  subject: string;
  text: string;
};

type GuestDetails = {
  firstName: string;
  trialEndDate?: string;
};

export function getPB101EmailTemplate(
  day: PB101EmailDay,
  guest: GuestDetails
): PB101EmailTemplate {
  const firstName = guest.firstName.trim() || "there";

  const templates: Record<
    PB101EmailDay,
    PB101EmailTemplate
  > = {
    0: {
      day: 0,
      subject: "Welcome to Pickleball Kingdom!",
      text: `Hi ${firstName},

Welcome to Pickleball Kingdom Lynnwood!

Congratulations on completing PB101! We're excited to welcome you into our pickleball community.

Your seven-day PB101+ experience is your opportunity to discover everything that makes pickleball special.

During your trial, you can participate in our designated beginner-friendly activities, subject to availability:

- Beginner / Pathway Open Play
- Guided PB101+ Open Play, with a coach helping you during the session
- PB101+ Skills & Drills, where you'll build confidence and improve your game

Your trial does not include intermediate, competitive, or DUPR-gated open plays.

Check the Pickleball Kingdom app for available sessions and registration.

We can't wait to see you back on the courts!

The Pickleball Kingdom Team`,
    },

    2: {
      day: 2,
      subject: "Ready for your next pickleball experience?",
      text: `Hi ${firstName},

How's your pickleball journey going?

Now that you've completed PB101, it's time to get back on the court!

We recommend trying a Guided PB101+ Open Play session. You'll have a coach there to help you understand the game, build confidence, and meet other players.

You can also join our Beginner / Pathway Open Plays or PB101+ Skills & Drills.

These designated activities are included in your seven-day PB101+ experience, subject to availability.

Check the Pickleball Kingdom app and sign up for your next session.

See you on the courts!

The Pickleball Kingdom Team`,
    },

    4: {
      day: 4,
      subject: "How's your pickleball journey going?",
      text: `Hi ${firstName},

You're already several days into your PB101+ experience!

We hope you've had the chance to meet new people, enjoy some games, and discover why we love pickleball.

If you're still learning, that's exactly what our beginner-friendly programs are designed for.

Try a PB101+ Skills & Drills session to practice the fundamentals, or join a Guided PB101+ Open Play to get comfortable playing with others.

Our team is always happy to help you find the right activity.

We look forward to seeing you again!

The Pickleball Kingdom Team`,
    },

    6: {
      day: 6,
      subject: "Keep playing with us — your membership invitation",
      text: `Hi ${firstName},

Your seven-day PB101+ experience is almost complete, but your pickleball journey is just getting started!

We'd love for you to become part of the Pickleball Kingdom Lynnwood community.

As a PB101 graduate, you can still take advantage of our waived membership initiation fee when you join.

Membership gives you access to our member benefits, including eligible open plays and opportunities to continue developing your game.

Our team would be happy to walk you through the membership options and help you find the right fit.

We hope to keep seeing you on the courts!

The Pickleball Kingdom Team`,
    },

    9: {
      day: 9,
      subject: "Your pickleball journey doesn't have to end!",
      text: `Hi ${firstName},

Thank you for being part of our PB101+ experience at Pickleball Kingdom Lynnwood!

We hope your first week gave you a taste of the fun, fitness, friendships, and community that pickleball offers.

Although your complimentary seven-day experience has ended, we'd love to welcome you back.

You can continue playing through a membership or participate in eligible activities at our regular nonmember rates.

If you're interested in becoming a member, ask our team about the waived initiation fee available to PB101 graduates.

We'd love to hear about your experience and help you take the next step.

See you on the courts!

The Pickleball Kingdom Team`,
    },
  };

  return templates[day];
}
