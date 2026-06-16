import type { MistakeStyle } from './ui/ghostDecoration';

export interface ExtensionSettings {
  ghostTextOpacity?: number;
  mistakeStyle?: string;
  allowPaste?: boolean;
}

export interface ExtensionModel {
  commandIds: {
    startLesson: 'cTrain.startLesson';
    practiceCurrentFile: 'cTrain.practiceCurrentFile';
    mockExam: 'cTrain.mockExam';
  };
  providerScheme: 'code-trainer';
  options: {
    ghostTextOpacity: number;
    mistakeStyle: MistakeStyle;
    allowPaste: boolean;
  };
}

export function createExtensionModel(settings: ExtensionSettings = {}): ExtensionModel {
  return {
    commandIds: {
      startLesson: 'cTrain.startLesson',
      practiceCurrentFile: 'cTrain.practiceCurrentFile',
      mockExam: 'cTrain.mockExam'
    },
    providerScheme: 'code-trainer',
    options: {
      ghostTextOpacity: clampOpacity(settings.ghostTextOpacity ?? 0.4),
      mistakeStyle: normalizeMistakeStyle(settings.mistakeStyle),
      allowPaste: settings.allowPaste ?? false
    }
  };
}

function clampOpacity(opacity: number): number {
  if (!Number.isFinite(opacity)) {
    return 0.4;
  }

  return Math.min(1, Math.max(0.1, opacity));
}

function normalizeMistakeStyle(style: string | undefined): MistakeStyle {
  if (style === 'underline' || style === 'outline' || style === 'squiggle') {
    return style;
  }

  return 'squiggle';
}
