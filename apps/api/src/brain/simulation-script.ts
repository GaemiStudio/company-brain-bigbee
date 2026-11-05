/**
 * The scripted #it-help workday streamed by the Simulate button.
 *
 * The story (see COMPANY_BRAIN_SPEC.md): The Hive's expense form "Next"
 * button is broken in Safari. Five Mac users complain, then the script
 * pauses so the presenter can type the sixth complaint live as Jane Doe.
 * That crosses the problem threshold. Then three Windows users say expenses
 * work fine for them, which is the organic solution. Noise is mixed in
 * throughout.
 *
 * Every author must have a laptop in the seeded IT inventory
 * (BIG_BEE_DEVICES in prisma/seed.ts), or the browser comparison can't see them.
 */

export type SimulationStep =
  | { readonly authorName: string; readonly text: string }
  | { readonly pauseForLiveMessage: true };

/** The message the presenter is expected to type during the pause. */
export const LIVE_MESSAGE_SUGGESTION = {
  authorName: 'Jane Doe',
  text: 'Hive won’t let me click Next on my expense report, deadline is Friday \u{1F629}',
} as const;

export const SIMULATION_SCRIPT: readonly SimulationStep[] = [
  { authorName: 'Ben Carter', text: 'morning all, printer on 3 is jammed again' },
  { authorName: 'Maya Chen', text: 'Next on the Hive expense form does nothing??' },
  { authorName: 'Olivia Brown', text: 'anyone have a spare HDMI adapter? presenting at 10' },
  { authorName: 'Chloe Davis', text: 'lunch order for the team is going in at 11:30, reply with yours' },
  { authorName: 'Leo Park', text: 'stuck on step 2 of my Hive expense report, Next won’t respond' },
  { authorName: 'Sam Nguyen', text: 'wifi on the 2nd floor keeps dropping' },
  { authorName: 'Ben Carter', text: 'who do I ask about a new desk chair?' },
  { authorName: 'Sara Kim', text: 'Is the Hive down? Can’t get past Next on my expense report' },
  { authorName: 'Olivia Brown', text: 'never mind, found an HDMI adapter in the supply closet' },
  { authorName: 'Chloe Davis', text: 'reminder: all-hands is at 3pm today' },
  {
    authorName: 'Tom Rivera',
    text: 'Clicking Next on the Hive expense form does nothing for me either',
  },
  { authorName: 'Sam Nguyen', text: 'is there a guest wifi password for visitors?' },
  {
    authorName: 'Ana Lopez',
    text: 'same, Next on my Hive expense form is stuck. ugh I’ll just download Chrome',
  },
  { authorName: 'Ben Carter', text: 'I need my password reset, locked out of email' },

  // The presenter types Jane's complaint here, which makes six.
  { pauseForLiveMessage: true },

  { authorName: 'Chloe Davis', text: 'does anyone know if the 4th floor kitchen has oat milk?' },
  {
    authorName: 'John Doe',
    text: 'Weird, works fine for me. Submitted my expense report on the Hive this morning.',
  },
  { authorName: 'Sam Nguyen', text: 'printer on 3 still jammed fyi' },
  {
    authorName: 'Raj Mehta',
    text: 'The Hive expense form went through fine for me, Next worked no problem',
  },
  { authorName: 'Olivia Brown', text: 'who has the projector remote for room B?' },
  {
    authorName: 'Emma Wilson',
    text: 'Just submitted my expenses on the Hive too, Next worked for me',
  },
  { authorName: 'Ben Carter', text: 'thanks, got into email again' },
  { authorName: 'Chloe Davis', text: 'pizza is here, kitchen on 4' },
  { authorName: 'Sam Nguyen', text: 'anyone else’s monitor flickering?' },
];
