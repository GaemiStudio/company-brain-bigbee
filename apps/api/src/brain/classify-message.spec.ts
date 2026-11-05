import { classifyMessage } from './classify-message';
import { LIVE_MESSAGE_SUGGESTION, SIMULATION_SCRIPT } from './simulation-script';

describe('classifyMessage', () => {
  it('classifies a broken-button complaint as a problem', () => {
    const inputText = 'Next on the Hive expense form does nothing??';

    const actualKind = classifyMessage(inputText);

    expect(actualKind).toBe('problem');
  });

  it('classifies "works fine for me" as a success', () => {
    const inputText = 'Weird, works fine for me. Submitted mine this morning.';

    const actualKind = classifyMessage(inputText);

    expect(actualKind).toBe('success');
  });

  it('treats "doesn\'t work" as a problem even though it contains "work"', () => {
    const inputText = "the expense form doesn't work";

    const actualKind = classifyMessage(inputText);

    expect(actualKind).toBe('problem');
  });

  it('understands curly apostrophes typed on a Mac', () => {
    const inputText = LIVE_MESSAGE_SUGGESTION.text;

    const actualKind = classifyMessage(inputText);

    expect(actualKind).toBe('problem');
  });

  it('classifies unrelated chatter as neither', () => {
    const inputText = 'anyone have a spare HDMI adapter? presenting at 10';

    const actualKind = classifyMessage(inputText);

    expect(actualKind).toBe('neither');
  });

  it.each([
    'hive isn’t working for me either',
    "hive isn't working for me either",
    'Hive won’t let me click Next on my expense report, deadline is Friday',
    'The expense page is not loading',
    'it doesn’t even load for me',
    'I couldn’t submit my expenses',
    'the Next button didn’t work',
    'HIVE WONT OPEN',
    'the form wont go through',
    'Next is broken again',
    'nothing happens when I click Next',
    'same issue here with the Hive',
    'same problem, expense form is frozen',
    'me too',
    'Same here!',
    'happening to me too',
    'also stuck on step 2',
    'expense upload keeps failing',
    'getting an error on the Hive',
    'still broken, no idea why',
    'Can’t click Next',
  ])('classifies "%s" as a problem', (inputText) => {
    const actualKind = classifyMessage(inputText);

    expect(actualKind).toBe('problem');
  });

  it.each([
    'works for me',
    'Next worked for me too',
    'it’s working fine on my laptop',
    'my expenses went through',
    'just submitted mine',
    'no issues here',
    'No problem on my end',
    'no problems at all, Next worked',
    'all good for me',
    'fine for me',
    'smooth as anything this morning',
  ])('classifies "%s" as a success', (inputText) => {
    const actualKind = classifyMessage(inputText);

    expect(actualKind).toBe('success');
  });

  it.each([
    'pizza is here, kitchen on 4',
    'thanks, got into email again',
    'reminder: all-hands is at 3pm today',
    'who has the projector remote for room B?',
  ])('keeps small talk "%s" as neither', (inputText) => {
    const actualKind = classifyMessage(inputText);

    expect(actualKind).toBe('neither');
  });

  it('finds exactly 5 scripted problem reports and 3 successes about The Hive', () => {
    const inputHiveMessages = SIMULATION_SCRIPT.flatMap((step) =>
      'text' in step && step.text.includes('Hive') ? [step.text] : [],
    );

    const actualKinds = inputHiveMessages.map(classifyMessage);

    expect(actualKinds.filter((kind) => kind === 'problem')).toHaveLength(5);
    expect(actualKinds.filter((kind) => kind === 'success')).toHaveLength(3);
  });
});
