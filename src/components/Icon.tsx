import React from 'react';
import Svg, { Circle, Path, Polygon, Rect } from 'react-native-svg';

import { ground } from '@/theme/tokens';

/** Icon set transcribed from assets/icons/*.svg (24px grid, stroke 2.75, currentColor). */
export type IconName =
  | 'pin'
  | 'route'
  | 'book'
  | 'sli'
  | 'stamp'
  | 'cam'
  | 'nav'
  | 'search'
  | 'chev'
  | 'back'
  | 'check'
  | 'x'
  | 'locate'
  | 'lock'
  | 'cloud'
  | 'share'
  | 'flag'
  | 'globe'
  | 'eye'
  | 'q'
  | 'walk'
  | 'bike'
  | 'bus'
  | 'plus'
  | 'tree'
  | 'wave'
  | 'col';

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 24, color = ground.text, strokeWidth = 2.75 }: Props) {
  const p = { fill: 'none' as const, stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      {name === 'pin' && (
        <>
          <Path {...p} d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <Circle {...p} cx={12} cy={10} r={3} />
        </>
      )}
      {name === 'route' && (
        <>
          <Circle {...p} cx={6} cy={19} r={3} />
          <Circle {...p} cx={18} cy={5} r={3} />
          <Path {...p} d="M12 19h4.5a3.5 3.5 0 0 0 0-7h-9a3.5 3.5 0 0 1 0-7H12" />
        </>
      )}
      {name === 'book' && (
        <>
          <Path {...p} d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z" />
          <Path {...p} d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z" />
        </>
      )}
      {name === 'sli' && (
        <>
          <Path {...p} d="M21 5h-7M9 5H3m18 7h-4m-8 0H3m18 7h-10M6 19H3" />
          <Circle {...p} cx={11} cy={5} r={2} />
          <Circle {...p} cx={15} cy={12} r={2} />
          <Circle {...p} cx={8.5} cy={19} r={2} />
        </>
      )}
      {name === 'stamp' && (
        <>
          <Path {...p} d="M5 22h14" />
          <Path {...p} d="M19 18H5a1 1 0 0 1-1-1v-1a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1z" />
          <Path {...p} d="M14 14l1-7a3 3 0 1 0-6 0l1 7" />
        </>
      )}
      {name === 'cam' && (
        <>
          <Path {...p} d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
          <Circle {...p} cx={12} cy={13} r={3.5} />
        </>
      )}
      {name === 'nav' && <Polygon {...p} points="3 11 22 2 13 21 11 13 3 11" />}
      {name === 'search' && (
        <>
          <Circle {...p} cx={11} cy={11} r={7} />
          <Path {...p} d="m21 21-4-4" />
        </>
      )}
      {name === 'chev' && <Path {...p} d="m9 5 7 7-7 7" />}
      {name === 'back' && <Path {...p} d="m15 5-7 7 7 7" />}
      {name === 'check' && <Path {...p} d="m4 12.5 5.5 5.5L20 6.5" />}
      {name === 'x' && <Path {...p} d="M6 6l12 12M18 6 6 18" />}
      {name === 'locate' && (
        <>
          <Circle {...p} cx={12} cy={12} r={7} />
          <Path {...p} d="M12 2v3m0 14v3M2 12h3m14 0h3" />
          <Circle {...p} cx={12} cy={12} r={1.6} />
        </>
      )}
      {name === 'lock' && (
        <>
          <Rect {...p} x={5} y={11} width={14} height={10} rx={3} />
          <Path {...p} d="M8 11V7a4 4 0 0 1 8 0v4" />
        </>
      )}
      {name === 'cloud' && <Path {...p} d="M17.5 19a4.5 4.5 0 0 0 .4-9A7 7 0 0 0 4.3 12.7 4 4 0 0 0 6 19z" />}
      {name === 'share' && (
        <>
          <Path {...p} d="M12 3v12M8 7l4-4 4 4" />
          <Path {...p} d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
        </>
      )}
      {name === 'flag' && <Path {...p} d="M5 21V4c4-2.5 8 2.5 12 0v10c-4 2.5-8-2.5-12 0" />}
      {name === 'globe' && (
        <>
          <Circle {...p} cx={12} cy={12} r={9} />
          <Path {...p} d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18" />
        </>
      )}
      {name === 'eye' && (
        <>
          <Path {...p} d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" />
          <Circle {...p} cx={12} cy={12} r={2.8} />
        </>
      )}
      {name === 'q' && (
        <>
          <Circle {...p} cx={12} cy={12} r={9} />
          <Path {...p} d="M9.5 9a2.6 2.6 0 1 1 3.8 2.3c-.8.5-1.3 1-1.3 2" />
          <Path {...p} d="M12 17h.01" />
        </>
      )}
      {name === 'walk' && (
        <>
          <Circle {...p} cx={13} cy={4} r={2} />
          <Path {...p} d="M13 7v5l3.5 3 .8 6" />
          <Path {...p} d="M13 12l-3.5 3-1 6" />
          <Path {...p} d="M13 8.5 8.5 10 7 13" />
          <Path {...p} d="M13 9.5l4 2.5 2.5-.8" />
        </>
      )}
      {name === 'bike' && (
        <>
          <Circle {...p} cx={6} cy={17} r={3.5} />
          <Circle {...p} cx={18} cy={17} r={3.5} />
          <Path {...p} d="M6 17 10 8h4.5l3.5 9M10 8 8.5 5H12" />
        </>
      )}
      {name === 'bus' && (
        <>
          <Rect {...p} x={4} y={3} width={16} height={14} rx={3} />
          <Path {...p} d="M4 10h16" />
          <Circle {...p} cx={8.5} cy={20} r={1.5} />
          <Circle {...p} cx={15.5} cy={20} r={1.5} />
        </>
      )}
      {name === 'plus' && <Path {...p} d="M12 5v14M5 12h14" />}
      {name === 'tree' && <Path {...p} d="M12 2 7 9h2.5L5 15h5v7h4v-7h5l-4.5-6H17z" />}
      {name === 'wave' && (
        <>
          <Path {...p} d="M2 9c2.5-2.5 5-2.5 7.5 0s5 2.5 7.5 0 4-2 5 0" />
          <Path {...p} d="M2 16c2.5-2.5 5-2.5 7.5 0s5 2.5 7.5 0 4-2 5 0" />
        </>
      )}
      {name === 'col' && <Path {...p} d="M4 21h16M6 21V10m4 11V10m4 11V10m4 11V10M3 10h18l-9-6z" />}
    </Svg>
  );
}
