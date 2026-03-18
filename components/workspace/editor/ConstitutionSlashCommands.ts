/**
 * ConstitutionSlashCommands — Slash command definitions for the constitution editor.
 *
 * These are constitution-specific commands that extend the base slash command menu.
 * The command format is compatible with SlashCommandMenu's internal CommandDef type.
 */

// ---------------------------------------------------------------------------
// Command type (matches SlashCommandMenu's internal CommandDef)
// ---------------------------------------------------------------------------

export interface ConstitutionCommandDef {
  id: string;
  label: string;
  description: string;
  icon: string;
}

// ---------------------------------------------------------------------------
// Constitution-specific commands
// ---------------------------------------------------------------------------

export const CONSTITUTION_COMMANDS: ConstitutionCommandDef[] = [
  {
    id: 'amend',
    label: 'Propose Amendment',
    description: 'Suggest changes to this article',
    icon: '\u270F\uFE0F', // pencil
  },
  {
    id: 'check-conflicts',
    label: 'Check Conflicts',
    description: 'Check for conflicts with other articles',
    icon: '\u26A0\uFE0F', // warning
  },
  {
    id: 'explain-impact',
    label: 'Explain Impact',
    description: 'Explain governance impact of this change',
    icon: '\uD83D\uDCCA', // bar chart
  },
  {
    id: 'compare-original',
    label: 'Compare Original',
    description: 'Show the original text',
    icon: '\uD83D\uDD0D', // magnifying glass
  },
];

// ---------------------------------------------------------------------------
// Constitution slash command types (union of all IDs)
// ---------------------------------------------------------------------------

export type ConstitutionSlashCommandType =
  | 'amend'
  | 'check-conflicts'
  | 'explain-impact'
  | 'compare-original';
