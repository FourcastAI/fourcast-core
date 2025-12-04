import { Activity, Github, Zap, Wifi, WifiOff, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface HeaderProps {
  lastUpdate: Date | null;
  isLive: boolean;
  cycleNumber: number;
  wsConnected?: boolean;
  wsClients?: number;
}

export function Header({ lastUpdate, isLive, cycleNumber, wsConnected = false, wsClients = 0 }: HeaderProps) {
  const formatTime = (date: Date | null) => {
    if (!date) return "—";
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between gap-4 px-4 md:px-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-chart-1" />
            <span className="text-xl font-bold tracking-tight">FOURCAST</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isLive && (
            <Badge 
              variant="outline" 
              className="gap-1.5 border-chart-2/50 bg-chart-2/10 text-chart-2"
              data-testid="badge-live-status"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-chart-2 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-chart-2"></span>
              </span>
              LIVE
            </Badge>
          )}
          <div className="hidden items-center gap-2 text-sm text-muted-foreground md:flex">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 cursor-help" data-testid="status-websocket">
                  {wsConnected ? (
                    <Wifi className="h-4 w-4 text-chart-2" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-muted-foreground" />
                  )}
                  {wsClients > 0 && (
                    <span className="flex items-center gap-0.5 text-xs">
                      <Users className="h-3 w-3" />
                      {wsClients}
                    </span>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{wsConnected ? "Real-time updates active" : "Connecting..."}</p>
                {wsClients > 0 && <p className="text-xs text-muted-foreground">{wsClients} viewers online</p>}
              </TooltipContent>
            </Tooltip>
            <span className="text-border">|</span>
            <Activity className="h-4 w-4" />
            <span>Cycle #{cycleNumber}</span>
            <span className="text-border">|</span>
            <span className="font-mono">{formatTime(lastUpdate)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            asChild
            data-testid="button-github"
          >
            <a
              href="https://github.com/fourcast/fourcast"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github className="h-5 w-5" />
              <span className="sr-only">GitHub</span>
            </a>
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
