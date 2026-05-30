import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  MapPin,
  Package,
  ScrollText,
  Skull,
  User,
} from "lucide-react";
import { useGame } from "@/context/GameContext";
import { ArchiveMapView } from "@/components/ArchiveMapView";
import { getEndReasonLabel } from "@/lib/adventureEnd";
import {
  formatArchiveDate,
  getPastAdventureTitle,
  type PastAdventureArchive,
} from "@/lib/pastAdventures";
import { eventTypeConfig, formatEventMeta, formatEventTime } from "@/lib/sessionEvents";
import { getLocationsVisitedCount } from "@/lib/sessionStats";
import { cn } from "@/lib/utils";

function ArchiveStats({ archive }: { archive: PastAdventureArchive }) {
  const stats = archive.summary?.stats;
  const items = [
    {
      label: "Enemies Defeated",
      value: stats?.enemies_defeated ?? archive.sessionStats.enemiesDefeated,
      icon: Skull,
    },
    {
      label: "Locations Visited",
      value: stats?.locations_visited ?? getLocationsVisitedCount(archive.sessionStats),
      icon: MapPin,
    },
    {
      label: "Items Collected",
      value: stats?.items_collected ?? archive.sessionStats.itemsCollected,
      icon: Package,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {items.map((stat) => (
        <div key={stat.label} className="narrative-panel border-gold/30 text-center py-4">
          <stat.icon className="h-5 w-5 text-primary mx-auto mb-2" />
          <p className="font-display text-2xl text-primary">{stat.value}</p>
          <p className="font-body text-[11px] text-muted-foreground mt-1">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}

function ArchiveMapSection({ archive }: { archive: PastAdventureArchive }) {
  if (!archive.map?.nodes.length) return null;

  return (
    <div className="narrative-panel border-gold/30 space-y-3">
      <p className="font-display text-xs uppercase tracking-wider text-primary">Journey Map</p>
      <ArchiveMapView
        map={archive.map}
        progressCompletedNodeIds={archive.progressCompletedNodeIds}
        locationsVisited={archive.sessionStats.locationsVisited}
      />
    </div>
  );
}

function ArchiveSessionLog({ archive }: { archive: PastAdventureArchive }) {
  const events = archive.sessionEvents.length
    ? archive.sessionEvents
    : archive.narrativeHistory.map((message, index) => ({
        id: message.id,
        type: message.role === "player" ? ("action" as const) : message.role === "gm" ? ("narrative" as const) : ("system" as const),
        timestamp: Date.now() - (archive.narrativeHistory.length - index) * 60_000,
        text: message.text,
      }));

  if (!events.length) return null;

  return (
    <div className="narrative-panel border-gold/30 overflow-hidden">
      <div className="flex items-center gap-2 mb-3">
        <ScrollText className="h-4 w-4 text-primary" />
        <p className="font-display text-xs uppercase tracking-wider text-primary">Session Log</p>
        <span className="text-[10px] text-muted-foreground font-body">({events.length} events)</span>
      </div>
      <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
        {events.map((event) => {
          const config = eventTypeConfig[event.type];
          const metaLine = "meta" in event ? formatEventMeta(event.meta) : null;
          return (
            <div
              key={event.id}
              className={cn(
                "rounded-sm border px-3 py-2.5 text-xs font-body",
                config.className,
              )}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", config.dotClassName)} />
                <span className="font-display text-[9px] uppercase tracking-wider text-muted-foreground">
                  {config.label}
                </span>
                <span className="text-[9px] text-muted-foreground/70 ml-auto tabular-nums">
                  {formatEventTime(event.timestamp)}
                </span>
              </div>
              {"location" in event && event.location && (
                <p className="text-[10px] text-muted-foreground/80 mb-1">@ {event.location}</p>
              )}
              <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap">{event.text}</p>
              {metaLine && (
                <p className="text-[10px] text-primary/80 mt-1.5 font-display tracking-wide">
                  {metaLine}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PastAdventureDetail({ archive }: { archive: PastAdventureArchive }) {
  const hero = archive.characterSnapshot;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <h2 className="font-display text-xl text-primary tracking-wider">
            {getPastAdventureTitle(archive)}
          </h2>
          <span className="text-[10px] uppercase tracking-wider font-display px-2 py-0.5 rounded-full border border-primary/30 text-primary">
            {getEndReasonLabel(archive.endReason)}
          </span>
        </div>
        <p className="font-body text-sm text-muted-foreground">
          Completed {formatArchiveDate(archive.completedAt)} · {hero.name} ({hero.race} {hero.characterClass})
        </p>
      </div>

      {archive.adventureDescription && (
        <div className="narrative-panel border-gold/30">
          <p className="font-display text-xs uppercase tracking-wider text-primary mb-2">Concept</p>
          <p className="font-body text-sm text-foreground/90 whitespace-pre-line leading-relaxed">
            {archive.adventureDescription}
          </p>
        </div>
      )}

      {archive.summary?.narrative && (
        <div className="narrative-panel border-gold/30">
          <p className="font-display text-xs uppercase tracking-wider text-primary mb-2">Chronicler&apos;s Tale</p>
          <p className="font-body text-sm text-foreground/90 whitespace-pre-line leading-relaxed">
            {archive.summary.narrative}
          </p>
        </div>
      )}

      <ArchiveStats archive={archive} />
      <ArchiveMapSection archive={archive} />
      <ArchiveSessionLog archive={archive} />
    </motion.div>
  );
}

export default function PastAdventures() {
  const { savesList, isLoading } = useGame();
  const heroesWithArchives = useMemo(
    () =>
      savesList
        .map((save) => ({
          save,
          archives: save.save_data.pastAdventures ?? [],
        }))
        .filter((entry) => entry.archives.length > 0),
    [savesList],
  );

  const [selectedHeroId, setSelectedHeroId] = useState<string | null>(null);
  const [selectedArchiveId, setSelectedArchiveId] = useState<string | null>(null);

  const activeHeroId = selectedHeroId ?? heroesWithArchives[0]?.save.id ?? null;
  const activeHero = heroesWithArchives.find((entry) => entry.save.id === activeHeroId);
  const activeArchive =
    activeHero?.archives.find((archive) => archive.id === selectedArchiveId) ??
    activeHero?.archives[0] ??
    null;

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="font-display text-primary animate-pulse">Loading chronicle...</p>
      </div>
    );
  }

  if (heroesWithArchives.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <BookOpen className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
        <h1 className="font-display text-2xl text-primary mb-3">Past Adventures</h1>
        <p className="font-body text-muted-foreground">
          Complete a quest and the Chronicler will preserve it here. Your hero lives on — only the
          tale moves into the archive.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto"
    >
      <div className="mb-8">
        <h1 className="text-3xl font-display text-primary text-gold-glow tracking-wider">
          Past Adventures
        </h1>
        <p className="font-body text-sm text-muted-foreground mt-2">
          Choose a hero, then revisit the quests they have already completed.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_280px_1fr] gap-6">
        <div className="narrative-panel border-gold/30 p-3 space-y-2">
          <p className="font-display text-[10px] uppercase tracking-wider text-primary px-2 pb-1">
            Heroes
          </p>
          {heroesWithArchives.map(({ save, archives }) => {
            const isActive = save.id === activeHeroId;
            return (
              <button
                key={save.id}
                type="button"
                onClick={() => {
                  setSelectedHeroId(save.id);
                  setSelectedArchiveId(null);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-left transition-colors",
                  isActive
                    ? "bg-primary/10 border border-primary/30"
                    : "hover:bg-primary/5 border border-transparent",
                )}
              >
                <div className="w-9 h-9 rounded-full border border-gold/50 overflow-hidden shrink-0 bg-card flex items-center justify-center">
                  {save.character.avatar ? (
                    <img src={save.character.avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-4 w-4 text-primary/70" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-display text-sm text-primary tracking-wider truncate">
                    {save.character_name}
                  </p>
                  <p className="font-body text-[11px] text-muted-foreground">
                    {archives.length} adventure{archives.length === 1 ? "" : "s"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="narrative-panel border-gold/30 p-3 space-y-2">
          <p className="font-display text-[10px] uppercase tracking-wider text-primary px-2 pb-1">
            Adventures
          </p>
          {activeHero?.archives.map((archive) => {
            const isActive = archive.id === activeArchive?.id;
            return (
              <button
                key={archive.id}
                type="button"
                onClick={() => setSelectedArchiveId(archive.id)}
                className={cn(
                  "w-full px-3 py-2.5 rounded-sm text-left transition-colors border",
                  isActive
                    ? "bg-primary/10 border-primary/30"
                    : "border-transparent hover:bg-primary/5",
                )}
              >
                <p className="font-display text-sm text-primary tracking-wider line-clamp-2">
                  {getPastAdventureTitle(archive)}
                </p>
                <p className="font-body text-[11px] text-muted-foreground mt-1">
                  {formatArchiveDate(archive.completedAt)} · {getEndReasonLabel(archive.endReason)}
                </p>
              </button>
            );
          })}
        </div>

        <div className="min-w-0">
          {activeArchive ? (
            <PastAdventureDetail archive={activeArchive} />
          ) : (
            <div className="narrative-panel text-center py-12">
              <p className="font-body text-muted-foreground">Select an adventure to read its chronicle.</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
