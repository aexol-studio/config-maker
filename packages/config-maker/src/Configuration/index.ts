/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import path from 'path';
import inquirer, { QuestionCollection } from 'inquirer';
import Conf from 'conf';
import AutoCompleteInputPrompt from '@/utils/AutoCompleteInputPrompt.js';
import { getEnvValue } from '@/common/envs.js';

type WithNonStringKeys<T> = Pick<
  T,
  {
    [P in keyof T]: T[P] extends string ? never : P;
  }[keyof T]
>;
type WithRequiredKeys<T> = Pick<
  T,
  {
    [P in keyof T]: T[P] extends undefined ? never : P;
  }[keyof T]
>;
type DefaultValues<T> = {
  [P in keyof WithRequiredKeys<T>]?: T[P];
};

type Coders<T> = {
  [P in keyof WithNonStringKeys<T>]: {
    decode: (v: string) => WithNonStringKeys<T>[P];
    encode: (v: WithNonStringKeys<T>[P]) => string;
  };
};

type AllOptions<C, G> = {
  options: Partial<C>;
  globalOptions: Partial<G>;
};
export class ConfigMaker<
  ConfigurationOptions extends Record<string, any>,
  GlobalOptions extends Record<string, any>,
> {
  private options: Partial<ConfigurationOptions> = {};
  private globalOptions = new Conf<GlobalOptions>({});
  private projectPath = process.cwd();
  constructor(
    public configFileName: string,
    public props: {
      // decoders are crucial for other types than string to work with environment variables and command line arguments
      decoders: Coders<ConfigurationOptions>;
      defaultValues?: DefaultValues<ConfigurationOptions>;
      prompts?: {
        [P in keyof ConfigurationOptions]?: {
          message: string;
          default?: string;
        };
      };
      pathToProject?: string;
      config?: {
        autocomplete?: {
          [P in keyof ConfigurationOptions]?: (
            currentConfig: AllOptions<ConfigurationOptions, GlobalOptions>,
          ) => Promise<string[]>;
        };
        environment?: {
          [P in keyof ConfigurationOptions]?: string;
        };
      };
      global?: {
        autocomplete?: {
          [P in keyof GlobalOptions]?: (
            currentConfig: AllOptions<ConfigurationOptions, GlobalOptions>,
          ) => Promise<string[]>;
        };
        environment?: {
          [P in keyof GlobalOptions]?: string;
        };
      };
    },
  ) {
    this.projectPath = props?.pathToProject || this.projectPath;
    this.init();
  }
  private configPath = () =>
    path.join(this.projectPath, this.configFileName + '.json');

  private init = () => {
    const cliConfig =
      fs.existsSync(this.configPath()) &&
      JSON.parse(fs.readFileSync(this.configPath()).toString('utf8'));
    // const authConfig = this.authConfig.get()
    if (cliConfig) {
      this.options = { ...this.props.defaultValues, ...cliConfig };
    }
  };

  private save = () => {
    fs.writeFileSync(
      this.configPath(),
      `${JSON.stringify(this.options, null, 4)}`,
    );
  };

  get = () => this.options;
  set = (config: ConfigurationOptions) => {
    this.options = config;
    this.save();
  };
  setValue = <T extends keyof ConfigurationOptions>(
    k: T,
    v: ConfigurationOptions[T],
  ) => {
    this.options[k] = v;
    this.save();
  };
  update = (opts?: Partial<ConfigurationOptions>) => {
    if (opts) {
      this.options = {
        ...this.options,
        ...opts,
      };
      this.save();
    }
  };
  getValueOrThrow = async <
    T extends keyof ConfigurationOptions,
    Z extends Record<string, any>,
  >(
    k: T,
    options?: {
      commandLineProvidedOptions?: Z;
      // when user is prompted for the value should we save json config file - defaults to true
      saveOnInput?: boolean;
    },
  ): Promise<ConfigurationOptions[T]> => {
    const v = await this.getValue(k, options);
    if (!v)
      throw new Error(`Cannot get ${k as string} value, please provide it.`);
    return v;
  };
  getValue = async <
    T extends keyof ConfigurationOptions,
    Z extends Record<string, any>,
  >(
    k: T,
    options?: {
      commandLineProvidedOptions?: Z;
      // when user is prompted for the value should we save json config file - defaults to true
      saveOnInput?: boolean;
    },
  ): Promise<ConfigurationOptions[T] | undefined> => {
    let returnValue: ConfigurationOptions[T] | undefined;
    const key = k as string;
    // check if there is a decoder for string values to be transferred to the right type
    const decoderFunction =
      k in this.props.decoders
        ? this.props.decoders[k as string as keyof Coders<ConfigurationOptions>]
            .decode
        : undefined;

    // This is highest hierarchy argument from command line
    const valueFromCommandLine =
      options?.commandLineProvidedOptions?.[k as string];
    if (valueFromCommandLine)
      returnValue = (decoderFunction?.(valueFromCommandLine) ||
        valueFromCommandLine) as ConfigurationOptions[T];

    // Then we check if there is environment variable.
    if (!returnValue) {
      const nameOfEnv = this.props?.config?.environment?.[k];
      if (nameOfEnv) {
        const valueFromEnv = getEnvValue(nameOfEnv);
        if (valueFromEnv) {
          returnValue = (decoderFunction?.(valueFromEnv) ||
            valueFromEnv) as ConfigurationOptions[T];
        }
      }
    }
    // Then we check if it is already in users config file
    if (this.options[k] && !returnValue) {
      return this.options[k] as ConfigurationOptions[T];
    }

    const optionsMessage = this.props.prompts?.[k]?.message;
    if (!returnValue) {
      // If there is no value we need to prompt
      // First we check if there is an autocomplete function provided
      const autocompleteFunction = this.props?.config?.autocomplete?.[k];
      if (autocompleteFunction) {
        const result = await AutoCompleteInputPrompt(
          await autocompleteFunction({
            options: this.options,
            globalOptions: this.globalOptions.store,
          }),
          {
            message: optionsMessage || 'Autocomplete ' + key,
            name: key,
          },
        );
        const decoded = decoderFunction?.(result) || result;
        returnValue = decoded as ConfigurationOptions[T];
      }
    }
    if (!returnValue) {
      // If there is no autocomplete we prompt with a simple string prompt
      const inqProps: QuestionCollection = {
        name: key,
        type: 'input',
        message: optionsMessage,
        default: this.props.prompts?.[k]?.default,
      };
      const answer = (await inquirer.prompt(inqProps))[k as string];
      const decoded = decoderFunction?.(answer) || answer;
      returnValue = decoded as ConfigurationOptions[T];
    }
    return returnValue;
  };

  // get global options that are usually stored in users $HOME folder
  getGlobalOptions = () => this.globalOptions;
  getGlobalOptionsValue = <T extends keyof GlobalOptions>(k: T) =>
    this.globalOptions.get(k);
  setGlobalOptions = (opts: GlobalOptions) => this.globalOptions.set(opts);
  updateGlobalOptions = (opts?: Partial<GlobalOptions>) => {
    if (opts) {
      this.globalOptions.set({ ...opts });
    }
  };
  clearGlobalOptions = () => this.globalOptions.clear();
  getGlobalOptionsPath = () => this.globalOptions.path;
  serializeConfigAsString = () =>
    Buffer.from(JSON.stringify(this.options)).toString('base64');
  deserializeConfigFromString = (serialized: string) =>
    Buffer.from(serialized, 'base64').toString('utf-8');
  public commandLineOptionsForYargs = <
    C extends Array<keyof ConfigurationOptions>,
  >(
    k: C,
  ) => {
    const options = Object.fromEntries(
      k.map((option) => [
        option,
        {
          type: 'string' as const,
          describe: this.props.prompts?.[option]?.message || (option as string),
        },
      ]),
    );
    return options;
  };
}
