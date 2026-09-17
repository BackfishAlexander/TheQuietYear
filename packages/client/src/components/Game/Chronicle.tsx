/**
 * The chronicle is the record of the quiet year, so an entry has to stand on
 * its own: a card carries the prompt that was chosen and the answer given, a
 * discussion carries every response it drew. Both the sidebar log and the
 * end-of-game summary render entries through here, on light or dark paper.
 */
import type { GameEvent, GameEventType, ResourceKind } from '@quiet-year/shared';
import {
  ACTION_COLORS, PROJECT_COMPLETED_COLOR, PROJECT_FAILED_COLOR,
  RESOURCE_COLORS, SEASON_COLORS,
} from '@quiet-year/shared';
import { Icon, type IconName } from './ToolIcons';

export const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

interface EntryStyle {
  /** An SVG glyph, or a bare character for the odd one-off marker. */
  icon: IconName | { glyph: string };
  color: string;
  label: string;
}

const ENTRY_STYLES: Record<GameEventType, EntryStyle> = {
  'card': { icon: { glyph: '♠' }, color: '#8a8a8a', label: 'Drew a card' },
  'discovery': { icon: 'discover', color: ACTION_COLORS.discover, label: 'Discovered something new' },
  'discussion': { icon: 'discuss', color: ACTION_COLORS.discuss, label: 'Held a discussion' },
  'project-started': { icon: 'project', color: ACTION_COLORS.project, label: 'Started a project' },
  'project-completed': { icon: 'check', color: PROJECT_COMPLETED_COLOR, label: 'Project completed' },
  'project-failed': { icon: 'cross', color: PROJECT_FAILED_COLOR, label: 'Project failed' },
  'project-changed': { icon: 'clock', color: '#8B6914', label: 'Project changed' },
  'contempt-taken': { icon: { glyph: '●' }, color: '#7f1d1d', label: 'Took a contempt token' },
  'contempt-discarded': { icon: { glyph: '○' }, color: '#a16207', label: 'Spent a contempt token' },
  'resource-added': { icon: { glyph: '◆' }, color: '#4a7c59', label: 'Added to the card' },
  'resource-removed': { icon: { glyph: '◇' }, color: '#4a7c59', label: 'Struck from the card' },
  'game-over': { icon: { glyph: '❄' }, color: '#3498db', label: 'The Frost Shepherds' },
};

interface Palette {
  surface: string;
  border: string;
  heading: string;
  body: string;
  muted: string;
}

const PALETTES: Record<'light' | 'dark', Palette> = {
  light: {
    surface: '#fffcf7', border: '#ece3d2',
    heading: '#9a9184', body: '#4a4a4a', muted: '#9a9184',
  },
  dark: {
    surface: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)',
    heading: '#7a7a95', body: '#c8c8d4', muted: '#7a7a95',
  },
};

export function ChronicleEntry({ event, theme = 'light' }: {
  event: GameEvent;
  theme?: 'light' | 'dark';
}) {
  const style = ENTRY_STYLES[event.type];
  const pal = PALETTES[theme];
  const kind = resourceKind(event);
  const accent = event.type === 'card'
    ? SEASON_COLORS[event.season] ?? style.color
    : kind
      ? RESOURCE_COLORS[kind]
      : style.color;

  return (
    <div style={{
      marginBottom: 8, fontSize: 12, lineHeight: 1.45,
      background: pal.surface,
      border: `1px solid ${pal.border}`,
      borderLeft: `3px solid ${accent}`,
      borderRadius: 6,
      padding: '7px 9px',
    }}>
      {/* Header: what kind of entry this is, who wrote it, and when */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5,
        color: pal.heading, fontSize: 10, marginBottom: 4,
        textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>
        <EntryBadge style={style} event={event} color={accent} />
        <span style={{ fontWeight: 600 }}>{headline(event, style)}</span>
        <span style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}>
          Wk {event.week} &middot; {event.playerName}
        </span>
      </div>

      <EntryBody event={event} pal={pal} accent={accent} />
    </div>
  );
}

function EntryBadge({ style, event, color }: { style: EntryStyle; event: GameEvent; color: string }) {
  // A card wears its own suit; everything else wears its action's glyph.
  const glyph = event.type === 'card'
    ? SUIT_SYMBOLS[event.card?.suit ?? ''] ?? '♠'
    : typeof style.icon === 'object' ? style.icon.glyph : null;

  if (glyph !== null) {
    return <span style={{ color, fontSize: 12, lineHeight: 1 }}>{glyph}</span>;
  }
  return <span style={{ color, display: 'flex' }}><Icon name={style.icon as IconName} size={12} /></span>;
}

const RESOURCE_LABELS: Record<ResourceKind, string> = {
  abundance: 'Abundance',
  scarcity: 'Scarcity',
  name: 'Name',
};

/** Which resource list an entry touched, if it touched one at all. */
function resourceKind(event: GameEvent): ResourceKind | null {
  if (event.type !== 'resource-added' && event.type !== 'resource-removed') return null;
  const kind = event.detail;
  return kind === 'abundance' || kind === 'scarcity' || kind === 'name' ? kind : null;
}

function headline(event: GameEvent, style: EntryStyle): string {
  if (event.type === 'card' && event.card) {
    const { rank, suit, choice } = event.card;
    return `${rank} of ${suit}${choice ? ` · option ${choice}` : ''}`;
  }
  const kind = resourceKind(event);
  if (kind) {
    return `${RESOURCE_LABELS[kind]} ${event.type === 'resource-added' ? 'added' : 'removed'}`;
  }
  return style.label;
}

function EntryBody({ event, pal, accent }: { event: GameEvent; pal: Palette; accent: string }) {
  const bodyText = (text: string) => (
    <div style={{ color: pal.body }}>{text}</div>
  );

  switch (event.type) {
    case 'card':
      return (
        <>
          {/* The prompt and the answer to it, kept together as one thought. */}
          {event.card?.promptText && (
            <div style={{ color: pal.muted, fontStyle: 'italic', marginBottom: event.text ? 4 : 0 }}>
              {event.card.promptText}
            </div>
          )}
          {event.text
            ? <div style={{ color: pal.body, paddingLeft: 8, borderLeft: `2px solid ${accent}40` }}>
                {event.text}
              </div>
            : !event.card?.promptText
              ? <div style={{ color: pal.muted, fontStyle: 'italic' }}>Choosing a prompt&hellip;</div>
              : null}
        </>
      );

    case 'discussion':
      return <DiscussionBody event={event} pal={pal} accent={accent} />;

    case 'project-started':
    case 'project-completed':
    case 'project-failed':
    case 'project-changed':
      return (
        <>
          <div style={{ color: pal.body, fontWeight: 600 }}>
            {event.text}
            {event.type === 'project-changed' && event.detail && (
              <span style={{ fontWeight: 400, color: pal.muted }}> &mdash; {event.detail}</span>
            )}
          </div>
          {event.type !== 'project-changed' && event.detail && (
            <div style={{ color: pal.muted, fontStyle: 'italic', marginTop: 2 }}>{event.detail}</div>
          )}
        </>
      );

    case 'contempt-taken':
      return event.text ? bodyText(event.text) : null;

    case 'contempt-discarded':
      return event.text
        ? bodyText(event.text)
        : <div style={{ color: pal.muted, fontStyle: 'italic' }}>No reason given</div>;

    default:
      return event.text ? bodyText(event.text) : null;
  }
}

function DiscussionBody({ event, pal, accent }: { event: GameEvent; pal: Palette; accent: string }) {
  const disc = event.discussion;
  return (
    <>
      <div style={{ color: pal.body, fontStyle: 'italic', marginBottom: 4 }}>
        &ldquo;{disc?.topic ?? event.text}&rdquo;
      </div>
      {disc?.responses.map((r, i) => (
        <div key={i} style={{
          paddingLeft: 8, borderLeft: `2px solid ${accent}35`,
          marginTop: 3, color: pal.body,
        }}>
          <span style={{ color: pal.muted, fontSize: 11 }}>
            {r.playerName}
            {r.playerId === disc.initiatedBy && ' (last word)'}:{' '}
          </span>
          {r.text || <span style={{ fontStyle: 'italic', color: pal.muted }}>passed</span>}
        </div>
      ))}
      {disc && !disc.complete && (
        <div style={{ color: pal.muted, fontStyle: 'italic', marginTop: 3 }}>
          Still going round the table&hellip;
        </div>
      )}
    </>
  );
}
