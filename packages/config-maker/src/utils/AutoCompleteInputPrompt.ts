import AwfulAutocompletePrompt from '@/utils/AwfulAutoCompletePrompt.js';
import inquirer, { DistinctQuestion } from 'inquirer';

inquirer.registerPrompt('autocomplete', AwfulAutocompletePrompt);

export type AutocompleteOptions = Omit<DistinctQuestion, 'type' | 'source'> &
  Required<Pick<DistinctQuestion, 'name' | 'message'>>;

const AutoCompleteInput = (
  choices: string[],
  options: AutocompleteOptions,
): DistinctQuestion & {
  source: (answersSoFar: string[], input: string) => Promise<string[]>;
} => ({
  type: 'autocomplete' as keyof DistinctQuestion['type'],
  source: async (answersSoFar, input) => {
    if (!input) {
      return choices;
    }
    return choices.filter(
      (t) => t.toLowerCase().indexOf(input.toLowerCase()) !== -1,
    );
  },
  ...options,
});

export default async (
  choices: string[],
  options: AutocompleteOptions,
): Promise<string> => {
  const answers = await inquirer.prompt(AutoCompleteInput(choices, options));
  return answers[options.name];
};
