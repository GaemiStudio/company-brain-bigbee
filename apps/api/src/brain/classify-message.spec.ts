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

  it('finds exactly 5 scripted problem reports and 3 successes about The Hive', () => {
    const inputHiveMessages = SIMULATION_SCRIPT.flatMap((step) =>
      'text' in step && step.text.includes('Hive') ? [step.text] : [],
    );

    const actualKinds = inputHiveMessages.map(classifyMessage);

    expect(actualKinds.filter((kind) => kind === 'problem')).toHaveLength(5);
    expect(actualKinds.filter((kind) => kind === 'success')).toHaveLength(3);
  });
});
