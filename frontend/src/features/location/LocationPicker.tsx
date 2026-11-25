import React, { useEffect, useId, useRef, useState } from 'react';
import { LocateFixed, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { MapView } from './MapView';
import { UZ_CENTER, useDeviceLocation, type Point } from './useDeviceLocation';

interface LocationPickerProps {
  open: boolean;
  title: string;
  /** Shown under the map: what the point is used for and who sees it. */
  note: string;
  initial: Point | null;
  confirmLabel?: string;
  busy?: boolean;
  error?: string;
  onConfirm: (point: Point) => void;
  onClose: () => void;
}

/**
 * Full-screen "move the map under the pin" picker. Starts at the given point, or asks the
 * browser for the position when there is none; the user can always just pan instead.
 */
export const LocationPicker: React.FC<LocationPickerProps> = ({ open, ...rest }) => {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={rest.onClose}
      aria-labelledby={titleId}
      className="m-0 h-[100dvh] max-h-none w-full max-w-none bg-surface p-0 text-ink sm:m-auto sm:h-[min(720px,90vh)] sm:max-w-2xl sm:rounded-2xl sm:border sm:border-line"
    >
      {open && <PickerBody titleId={titleId} {...rest} />}
    </dialog>
  );
};

const PickerBody: React.FC<Omit<LocationPickerProps, 'open'> & { titleId: string }> = ({
  titleId,
  title,
  note,
  initial,
  confirmLabel = 'Shu joyni tanlash',
  busy = false,
  error,
  onConfirm,
  onClose,
}) => {
  const { detect, status, message } = useDeviceLocation();
  const [center, setCenter] = useState<Point>(initial ?? UZ_CENTER);
  const [flyTo, setFlyTo] = useState<Point | null>(null);
  const [moved, setMoved] = useState(Boolean(initial));

  const findMe = async () => {
    const p = await detect();
    if (p) {
      setFlyTo(p);
      setMoved(true);
    }
  };

  // No starting point: try the device once, so most people only confirm.
  const asked = useRef(false);
  useEffect(() => {
    if (initial || asked.current) return;
    asked.current = true;
    void findMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on open
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
        <h2 id={titleId} className="font-display text-[20px] leading-tight">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Yopish"
          className="min-h-touch min-w-touch flex items-center justify-center rounded-xl text-ink-muted"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        <MapView
          mode="pick"
          center={center}
          zoom={initial ? 15 : 6}
          flyTo={flyTo}
          onMove={(p) => {
            setCenter(p);
            setMoved(true);
          }}
          className="h-full w-full"
          label="Xarita. Kerakli joyni pin ostiga suring."
        />
        <button
          type="button"
          onClick={() => void findMe()}
          disabled={status === 'locating'}
          className="absolute bottom-4 right-4 z-[500] inline-flex min-h-touch items-center gap-2 rounded-full bg-surface px-4 text-[15px] font-semibold text-ink shadow-lg disabled:opacity-60"
        >
          <LocateFixed className="w-5 h-5 text-brand" aria-hidden="true" />
          {status === 'locating' ? 'Aniqlanmoqda…' : 'Mening joylashuvim'}
        </button>
      </div>

      <div className="space-y-2 border-t border-line p-4">
        <p className="text-[13px] text-ink-muted">{note}</p>
        {(message || error) && (
          <p role="alert" className="text-[13px] text-danger">
            {error || message}
          </p>
        )}
        <Button
          variant="primary"
          className="w-full"
          disabled={!moved || busy}
          onClick={() => onConfirm(center)}
        >
          {busy ? 'Saqlanmoqda…' : moved ? confirmLabel : 'Xaritani suring yoki joylashuvni aniqlang'}
        </Button>
      </div>
    </div>
  );
};
