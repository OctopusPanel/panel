import { VariableInterpolator, VariableContext } from './variable-interpolator.js';

export interface ConfigFileRule {
  file: string;
  parser: 'file' | 'yaml' | 'json' | 'properties' | 'ini';
  findAndReplace?: Record<string, string>;
  insertAfter?: Record<string, string>;
}

export class ConfigProcessor {
  /**
   * Process configuration file rules against raw file content
   */
  static processFileContent(
    content: string,
    rule: ConfigFileRule,
    ctx: VariableContext,
  ): string {
    let result = content;

    // 1. Process find-and-replace rules
    if (rule.findAndReplace) {
      for (const [findPattern, replaceValue] of Object.entries(rule.findAndReplace)) {
        const interpolatedReplacement = VariableInterpolator.interpolateString(replaceValue, ctx);
        // Replace exact match or regex
        result = result.split(findPattern).join(interpolatedReplacement);
      }
    }

    // 2. Process insert-after rules
    if (rule.insertAfter) {
      for (const [targetLine, textToInsert] of Object.entries(rule.insertAfter)) {
        const interpolatedText = VariableInterpolator.interpolateString(textToInsert, ctx);
        const index = result.indexOf(targetLine);
        if (index !== -1) {
          const insertPosition = index + targetLine.length;
          result =
            result.slice(0, insertPosition) +
            '\n' +
            interpolatedText +
            result.slice(insertPosition);
        }
      }
    }

    return result;
  }
}
