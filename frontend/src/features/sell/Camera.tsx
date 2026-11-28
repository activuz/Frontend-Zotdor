import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera as CameraIcon, Circle, Copy, Loader2, RotateCcw, Square, Trash2, Video } from 'lucide-react';
import { ApiError } from '../../api/http';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Field';
import type { AuctionDetail } from '../auctions/api';
import type { PublicConfig } from '../reference/api';
import { useOpenCaptureSession, type CaptureSession } from './api';
import { MediaGrid } from './MediaGrid';
import { enqueueUpload, previewOf, removeUpload, retryUpload, useUploads, type PendingUpload } from './uploads';

const PHOTO_HINTS = [
  'Molni yonidan, toʻliq koʻrinadigan qilib oling',
  'Endi old tomonidan oling',
  'Endi orqa tomonidan oling',
  'Ikkinchi yonidan oling',
];
const EXTRA_HINT = 'Qoʻshimcha rasm: tishlari, tuyogʻi yoki boshqa muhim joyi';
const VIDEO_HINT = 'Molni atrofidan aylanib, yurganini koʻrsatib video oling';

type CamError = 'denied' | 'missing' | 'unsupported' | null;

function pickVideoType(): string {
  const types = ['video/mp4', 'video/webm;codecs=vp8', 'video/webm'];
  return types.find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) ?? '';
}

const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches;

/**
 * In-page camera (F2 step 3, BR-12). Gallery uploads are not offered on purpose:
 * every file is bound to a short capture session of this auction.
 */
export const CameraStep: React.FC<{ auction: AuctionDetail; config: PublicConfig }> = ({ auction, config }) => {
  const [onThisDevice, setOnThisDevice] = useState(isTouchDevice);
  const uploads = useUploads(auction.id);
  const media = auction.media.filter((m) => m.status !== 'failed');
  const failed = auction.media.filter((m) => m.status === 'failed');
  // Files still on the device count too: the seller keeps shooting without waiting for them.
  const waiting = uploads.filter((u) => u.state !== 'failed');
  const photos = media.filter((m) => m.kind === 'photo').length + waiting.filter((u) => u.kind === 'photo').length;
  const videos = media.filter((m) => m.kind === 'video').length + waiting.filter((u) => u.kind === 'video').length;

  return (
    <div className="space-y-4">
      <p className="text-[17px] font-semibold text-ink tabular-nums" aria-live="polite">
        Rasmlar {photos}/{config.photos_min}, video {videos}/{config.videos_min}
      </p>
      {onThisDevice ? (
        <LiveCamera auction={auction} config={config} photoCount={photos} videoCount={videos} />
      ) : (
        <Handoff auctionId={auction.id} onUseHere={() => setOnThisDevice(true)} />
      )}
      {failed.length > 0 && (
        <Alert>Baʼzi fayllarni qayta ishlab boʻlmadi: {failed.map((m) => m.error).filter(Boolean).join(' ') || 'qaytadan oling.'}</Alert>
      )}
      {uploads.length > 0 && <PendingUploads items={uploads} />}
      <MediaGrid auction={auction} />
    </div>
  );
};

/** Taken but not on the server yet: sent in the background, kept on the device until then. */
const PendingUploads: React.FC<{ items: PendingUpload[] }> = ({ items }) => {
  const waiting = items.filter((u) => u.state !== 'failed').length;
  return (
    <section aria-label="Yuborilayotgan fayllar" className="space-y-2">
      {waiting > 0 && (
        <p role="status" className="text-[15px] text-ink-muted">
          {waiting} ta fayl fonda yuborilmoqda. Davom etavering.
        </p>
      )}
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {items.map((u) => {
          const src = previewOf(u.id);
          return (
            <li key={u.id} className="relative aspect-square overflow-hidden rounded-xl border border-line bg-surface">
              {src ? (
                <img src={src} alt="" className="h-full w-full object-cover opacity-70" />
              ) : (
                <span className="flex h-full items-center justify-center text-[13px] text-ink">
                  {u.kind === 'video' ? 'Video' : 'Rasm'}
                </span>
              )}
              {u.state === 'failed' ? (
                <div className="absolute inset-0 flex flex-col justify-end gap-1 bg-ink/60 p-1">
                  <p className="text-[13px] leading-tight text-surface">{u.error || 'Yuborib boʻlmadi.'}</p>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => void retryUpload(u.id)}
                      aria-label="Qayta yuborish"
                      className="flex min-h-touch flex-1 items-center justify-center rounded-lg bg-surface text-ink"
                    >
                      <RotateCcw className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeUpload(u.id)}
                      aria-label="Oʻchirish"
                      className="flex min-h-touch flex-1 items-center justify-center rounded-lg bg-surface text-danger"
                    >
                      <Trash2 className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ) : (
                <Loader2
                  className="absolute inset-0 m-auto h-7 w-7 animate-spin text-surface drop-shadow"
                  aria-label={u.state === 'uploading' ? 'Yuborilmoqda' : 'Navbatda'}
                />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

const Handoff: React.FC<{ auctionId: string; onUseHere: () => void }> = ({ auctionId, onUseHere }) => {
  const link = `${window.location.origin}/sell/${auctionId}?step=media`;
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 space-y-3">
      <p className="text-[17px] font-semibold text-ink">Iltimos, telefoningizdan davom eting</p>
      <p className="text-[15px] text-ink-muted">
        Rasm va video faqat kamera orqali, shu yerning oʻzida olinadi. Telefonda shu havolani oching va xuddi shu
        hisob bilan kiring — qoralamangiz saqlangan.
      </p>
      <p className="break-all rounded-xl bg-page p-3 text-[15px] text-ink">{link}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() =>
            void navigator.clipboard
              ?.writeText(link)
              .then(() => setCopied(true))
              .catch(() => setCopied(false))
          }
        >
          <Copy className="w-4 h-4" aria-hidden="true" />
          {copied ? 'Nusxa olindi' : 'Havoladan nusxa olish'}
        </Button>
        <Button variant="ghost" onClick={onUseHere}>
          Shu qurilma kamerasidan foydalanish
        </Button>
      </div>
    </div>
  );
};

const LiveCamera: React.FC<{
  auction: AuctionDetail;
  config: PublicConfig;
  photoCount: number;
  videoCount: number;
}> = ({ auction, config, photoCount, videoCount }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const [active, setActive] = useState(false);
  const [mode, setMode] = useState<'photo' | 'video'>(photoCount < config.photos_min ? 'photo' : 'video');
  const [camError, setCamError] = useState<CamError>(null);
  const [recording, setRecording] = useState(0); // seconds recorded, 0 = idle
  const [session, setSession] = useState<CaptureSession | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const openSession = useOpenCaptureSession(auction.id);
  const [saving, setSaving] = useState(0); // files being written to the device right now

  const photosFull = photoCount >= config.photos_max;
  const videosFull = videoCount >= config.videos_max;

  const stop = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  }, []);

  useEffect(() => stop, [stop]);

  const ensureSession = async (): Promise<CaptureSession> => {
    if (session && new Date(session.expires_at).getTime() - Date.now() > 30_000) return session;
    const fresh = await openSession.mutateAsync();
    setSession(fresh);
    return fresh;
  };

  const start = async () => {
    setCamError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError('unsupported');
      return;
    }
    try {
      await ensureSession();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      setActive(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch (e) {
      if (e instanceof ApiError) {
        setNotice(e.message);
        return;
      }
      const name = e instanceof DOMException ? e.name : '';
      setCamError(name === 'NotAllowedError' ? 'denied' : name === 'NotFoundError' ? 'missing' : 'unsupported');
    }
  };

  const send = async (blob: Blob, kind: 'photo' | 'video', meta: Record<string, string | number>) => {
    setNotice(null);
    const ext = kind === 'photo' ? 'jpg' : blob.type.includes('mp4') ? 'mp4' : 'webm';
    const file = new File([blob], `${kind}-${Date.now()}.${ext}`, { type: blob.type });
    setSaving((n) => n + 1);
    try {
      const s = await ensureSession();
      await enqueueUpload({
        auctionId: auction.id,
        kind,
        blob: file,
        fileName: file.name,
        sessionId: s.id,
        meta: { ...meta, captured_at: new Date().toISOString() },
      });
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Faylni saqlab boʻlmadi. Qayta urinib koʻring.');
    } finally {
      setSaving((n) => n - 1);
    }
  };

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => blob && void send(blob, 'photo', { source: 'camera', width: canvas.width, height: canvas.height }),
      'image/jpeg',
      0.9,
    );
  };

  const toggleRecording = () => {
    const stream = streamRef.current;
    if (!stream) return;
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
      return;
    }
    const type = pickVideoType();
    let recorder: MediaRecorder;
    try {
      recorder = type ? new MediaRecorder(stream, { mimeType: type }) : new MediaRecorder(stream);
    } catch {
      setCamError('unsupported');
      return;
    }
    const chunks: Blob[] = [];
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const s = Math.floor((Date.now() - startedAt) / 1000) + 1;
      setRecording(s);
      if (s >= config.video_max_s && recorder.state === 'recording') recorder.stop();
    }, 1000);
    recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    recorder.onstop = () => {
      window.clearInterval(timer);
      setRecording(0);
      const blob = new Blob(chunks, { type: recorder.mimeType || type || 'video/webm' });
      if (blob.size > 0) void send(blob, 'video', { source: 'camera', duration_ms: Date.now() - startedAt });
    };
    recorderRef.current = recorder;
    recorder.start(1000);
    setRecording(1);
  };

  const hint =
    mode === 'video' ? VIDEO_HINT : (PHOTO_HINTS[photoCount] ?? EXTRA_HINT);

  return (
    <div className="space-y-3">
      <div role="group" aria-label="Rejim" className="flex gap-2">
        {(['photo', 'video'] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            disabled={recording > 0}
            onClick={() => setMode(m)}
            className={`flex-1 min-h-touch rounded-xl border text-[15px] font-semibold ${mode === m ? 'border-brand bg-brand-soft text-ink' : 'border-line bg-surface text-ink-muted'}`}
          >
            {m === 'photo' ? 'Rasm' : 'Video'}
          </button>
        ))}
      </div>
      <p className="rounded-xl bg-brand-soft p-3 text-[15px] text-ink">{hint}</p>

      {camError === 'denied' && (
        <Alert>
          Kameraga ruxsat berilmagan. Brauzerning manzil qatoridagi qulf belgisini bosing, “Kamera” bandida “Ruxsat
          berish”ni tanlang va sahifani yangilang. Telefon sozlamalarida ham brauzerga kamera ruxsati yoqilgan
          boʻlishi kerak.
        </Alert>
      )}
      {camError === 'missing' && <Alert>Kamera topilmadi. Telefoningizdan davom eting.</Alert>}
      {camError === 'unsupported' && (
        <Alert>Bu brauzer kamerani qoʻllab-quvvatlamaydi. Chrome yoki Safariʼning yangi versiyasidan foydalaning.</Alert>
      )}
      {notice && <Alert>{notice}</Alert>}

      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-ink">
        {active ? (
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Button variant="secondary" onClick={() => void start()} disabled={openSession.isPending}>
              <CameraIcon className="w-5 h-5" aria-hidden="true" />
              {openSession.isPending ? 'Tayyorlanmoqda…' : 'Kamerani ochish'}
            </Button>
          </div>
        )}
        {recording > 0 && (
          <p className="absolute left-3 top-3 rounded-lg bg-danger px-2 text-[15px] font-semibold text-white tabular-nums">
            {recording} / {config.video_max_s} s
          </p>
        )}
      </div>

      {active && (
        <div className="flex gap-2">
          {mode === 'photo' ? (
            <Button variant="primary" className="flex-1" onClick={takePhoto} disabled={photosFull}>
              <Circle className="w-5 h-5" aria-hidden="true" />
              {photosFull ? 'Rasmlar yetarli' : 'Rasmga olish'}
            </Button>
          ) : (
            <Button
              variant="primary"
              className="flex-1"
              onClick={toggleRecording}
              disabled={videosFull && recording === 0}
            >
              {recording > 0 ? <Square className="w-5 h-5" aria-hidden="true" /> : <Video className="w-5 h-5" aria-hidden="true" />}
              {recording > 0 ? 'Toʻxtatish' : videosFull ? 'Video yetarli' : 'Yozishni boshlash'}
            </Button>
          )}
          <Button onClick={stop} disabled={recording > 0}>
            Yopish
          </Button>
        </div>
      )}
      {saving > 0 && (
        <p role="status" className="text-[15px] text-ink-muted">
          Saqlanmoqda…
        </p>
      )}
    </div>
  );
};
