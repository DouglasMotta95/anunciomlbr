import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, MonitorPlay, Subtitles } from "lucide-react";
import demoVideoAsset from "@/assets/demo/platform-demo.mp4.asset.json";

const demoVideo = demoVideoAsset.url;
import { SectionTitle } from "@/components/landing/sections";
import { cn } from "@/lib/utils";

/**
 * Seção de vídeo de demonstração da plataforma na landing page.
 * Mostra rapidamente como o ANÚNCIO ML funciona para novos vendedores.
 */
/**
 * Legendas do tour (pt-BR) — o vídeo é compreensível sem áudio.
 * Tempos em segundos, sincronizados com o screencast de ~10s.
 */
const CAPTIONS: Array<{ from: number; to: number; text: string }> = [
  { from: 0, to: 1.8, text: "Painel do ANÚNCIO ML: vendas, visitas e lucro em tempo real." },
  { from: 1.8, to: 3.6, text: "O radar encontra anúncios campeões do Mercado Livre em segundos." },
  { from: 3.6, to: 5.4, text: "Você seleciona os produtos e cria rascunhos em massa." },
  { from: 5.4, to: 7.2, text: "A IA reescreve título, descrição e ficha técnica otimizados." },
  { from: 7.2, to: 8.8, text: "Publicação oficial direto na sua conta do Mercado Livre." },
  { from: 8.8, to: 11, text: "Estoque, pedidos e licença controlados em um só lugar." },
];

export function VideoDemoSection() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);

  // Sincroniza a legenda com o tempo do vídeo (frame a frame do player).
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCurrentTime(v.currentTime);
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, []);

  const activeCaption =
    CAPTIONS.find((cue) => currentTime >= cue.from && currentTime < cue.to)?.text ?? CAPTIONS[0].text;

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  return (
    <section id="video-demo" className="border-b border-border/60 py-16 sm:py-24">
      <div className="mx-auto max-w-5xl px-4">
        <SectionTitle
          eyebrow="Tour rápido"
          title="Veja a plataforma em ação em menos de 1 minuto"
          subtitle="Um resumo visual do painel: métricas em tempo real, anúncios duplicados com IA e publicação direta no Mercado Livre."
        />

        <div className="relative mx-auto mt-10 max-w-4xl">
          {/* Glow decorativo */}
          <div
            aria-hidden
            className="absolute -inset-6 rounded-3xl bg-primary/10 blur-2xl"
          />

          <div className="group relative overflow-hidden rounded-2xl border border-border/60 bg-surface shadow-2xl shadow-black/40">
            {/* Barra estilo navegador */}
            <div className="flex items-center gap-2 border-b border-border/60 bg-background/80 px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-primary/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
              <span className="ml-3 hidden items-center gap-1.5 rounded-md bg-surface px-3 py-1 text-[11px] text-muted-foreground sm:flex">
                <MonitorPlay className="h-3 w-3" />
                app.anuncioml.com.br
              </span>
            </div>

            <div className="relative aspect-video w-full">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                loop
                muted={muted}
                playsInline
                preload="metadata"
                onClick={togglePlay}
              >
                <source src="/videos/platform-demo.webm" type="video/webm" />
                <source src={demoVideo} type="video/mp4" />
              </video>

              {/* Legendas queimadas na tela (sem depender do áudio) */}
              {captionsOn && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-4 pb-4 sm:pb-6">
                  <p
                    aria-live="polite"
                    className="max-w-[92%] rounded-lg bg-black/75 px-3 py-2 text-center text-[13px] font-semibold leading-snug text-white shadow-lg backdrop-blur-sm sm:text-base"
                  >
                    {activeCaption}
                  </p>
                </div>
              )}

              {/* Overlay de play */}
              {!playing && (
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label="Reproduzir vídeo de demonstração"
                  className="absolute inset-0 flex items-center justify-center bg-black/45 transition-colors hover:bg-black/55"
                >
                  <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow transition-transform hover:scale-105">
                    <Play className="ml-1 h-8 w-8 fill-current" />
                  </span>
                </button>
              )}

              {/* Controles quando em reprodução */}
              {playing && (
                <div className="absolute bottom-3 right-3 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={togglePlay}
                    aria-label={playing ? "Pausar vídeo" : "Reproduzir vídeo"}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full",
                      "bg-black/60 text-white backdrop-blur transition hover:bg-black/80",
                    )}
                  >
                    <Pause className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCaptionsOn((value) => !value)}
                    aria-label={captionsOn ? "Ocultar legendas" : "Mostrar legendas"}
                    aria-pressed={captionsOn}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full backdrop-blur transition",
                      captionsOn
                        ? "bg-primary text-primary-foreground"
                        : "bg-black/60 text-white hover:bg-black/80",
                    )}
                  >
                    <Subtitles className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={toggleMute}
                    aria-label={muted ? "Ativar som" : "Silenciar"}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/80"
                  >
                    {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Demonstração visual do produto — com legendas em português, dá para entender tudo sem
          áudio.
        </p>
      </div>
    </section>
  );
}
