import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { useControl } from 'react-map-gl/mapbox';

export default function DrawControl({
  onCreate = () => {},
  onUpdate = () => {},
  onDelete = () => {},
  position,
  ...drawOptions
}) {
  useControl(
    () => new MapboxDraw(drawOptions),
    ({ map }) => {
      map.on('draw.create', onCreate);
      map.on('draw.update', onUpdate);
      map.on('draw.delete', onDelete);
    },
    ({ map }) => {
      map.off('draw.create', onCreate);
      map.off('draw.update', onUpdate);
      map.off('draw.delete', onDelete);
    },
    {
      position
    }
  );

  return null;
}