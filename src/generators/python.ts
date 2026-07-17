import buggyTemplate from './templates/pixel_array_buggy.py?raw';
import correctedTemplate from './templates/pixel_array.py?raw';

export function generatePythonCode(isCorrected: boolean): string {
  return isCorrected ? correctedTemplate : buggyTemplate;
}
