import { memo, useCallback } from 'react';
import { FlatList, View, type ListRenderItemInfo } from 'react-native';

import Tile from '@/ui/tile/Tile';
import type { TileItem } from '@/ui/tile/types';

import { tileSide, type GridCell, type HomeRow } from './helpers';
import HomeEmptyCard from './HomeEmptyCard';
import HomeSectionHeader from './HomeSectionHeader';
import NewPresetTile from './NewPresetTile';
import NoticeBanner from './NoticeBanner';

import type { HomeHandlers } from './useHomeHandlers';

export const SCREEN_PADDING = 16;
export const TILE_GAP = 12;

const CAROUSEL_STYLE = { marginHorizontal: -SCREEN_PADDING, marginTop: 12 };
const CAROUSEL_CONTENT_STYLE = { paddingHorizontal: SCREEN_PADDING, gap: TILE_GAP };
const GRID_ROW_STYLE = { gap: TILE_GAP };

const getTileKey = (item: TileItem) => item.id;

interface CarouselProps {
  items: TileItem[];
  onMenuPress: HomeHandlers['onMenuPress'];
}

const Carousel = ({ items, onMenuPress }: CarouselProps) => {
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<TileItem>) => (
      <Tile item={item} size="large" onMenuPress={onMenuPress} />
    ),
    [onMenuPress],
  );

  return (
    <FlatList
      horizontal
      data={items}
      keyExtractor={getTileKey}
      renderItem={renderItem}
      showsHorizontalScrollIndicator={false}
      style={CAROUSEL_STYLE}
      contentContainerStyle={CAROUSEL_CONTENT_STYLE}
    />
  );
};

interface GridRowProps {
  cells: GridCell[];
  columns: number;
  width: number;
  handlers: HomeHandlers;
}

const GridRow = ({ cells, columns, width, handlers }: GridRowProps) => {
  const side = tileSide(width, columns, TILE_GAP, SCREEN_PADDING);
  const size = columns === 4 ? 'small' : 'square';

  return (
    <View className="mt-3 flex-row" style={GRID_ROW_STYLE}>
      {cells.map((cell) =>
        'run' in cell ? (
          <Tile
            key={cell.id}
            item={cell}
            size={size}
            side={side}
            onMenuPress={handlers.onMenuPress}
          />
        ) : (
          <NewPresetTile key={cell.id} side={side} onPress={handlers.onNewPreset} />
        ),
      )}
    </View>
  );
};

interface HomeRowViewProps {
  row: HomeRow;
  width: number;
  handlers: HomeHandlers;
}

const HomeRowView = ({ row, width, handlers }: HomeRowViewProps) => {
  switch (row.type) {
    case 'notice':
      return <NoticeBanner onConnect={handlers.onConnect} />;
    case 'header':
      return <HomeSectionHeader section={row.section} handlers={handlers} />;
    case 'empty':
      return <HomeEmptyCard section={row.section} onNewPreset={handlers.onNewPreset} />;
    case 'carousel':
      return <Carousel items={row.items} onMenuPress={handlers.onMenuPress} />;
    case 'grid':
      return <GridRow cells={row.cells} columns={row.columns} width={width} handlers={handlers} />;
  }
};

export default memo(HomeRowView);
