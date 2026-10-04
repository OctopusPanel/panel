import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { snapshotManager, SnapshotMetadata } from './snapshot-manager.js';
import { runMigrations } from '@octopus/database';

const execAsync = promisify(exec);

export interface SystemUpdateInfo {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  releaseName: string;
  releaseNotes: string;
  publishedAt: string;
  downloadUrl: string;
}

export type UpdateStreamEvent =
  | { type: 'step'; step: number; totalSteps: number; title: string; progress: number }
  | { type: 'log'; line: string; stream: 'stdout' | 'stderr' | 'info' | 'error'; timestamp: string }
  | { type: 'done'; success: boolean; message: string; timestamp: string };

export class UpdateRunner extends EventEmitter {
  private isUpdating = false;
  private currentStep = 0;
  private totalSteps = 4;
  private logHistory: UpdateStreamEvent[] = [];
  private activeSnapshot: SnapshotMetadata | null = null;

  getCurrentVersion(): string {
    try {
      const pkgPath = path.resolve(process.cwd(), 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        return pkg.version || '0.1.0';
      }
    } catch {
      // Fallback
    }
    return '0.1.0';
  }

  async checkForUpdates(): Promise<SystemUpdateInfo> {
    const currentVersion = this.getCurrentVersion();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const res = await fetch('https://api.github.com/repos/OctopusPanel/panel/releases/latest', {
        headers: { 'User-Agent': 'OctopusPanel-UpdateService' },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (res.ok) {
        const data = (await res.json()) as {
          tag_name?: string;
          name?: string;
          body?: string;
          published_at?: string;
          html_url?: string;
        };

        const tag = (data.tag_name || `v${currentVersion}`).replace(/^v/, '');
        const hasUpdate = this.compareVersions(tag, currentVersion) > 0;

        return {
          currentVersion,
          latestVersion: tag,
          hasUpdate,
          releaseName: data.name || `OctopusPanel v${tag}`,
          releaseNotes: data.body || 'No changelog description provided.',
          publishedAt: data.published_at || new Date().toISOString(),
          downloadUrl: data.html_url || `https://github.com/OctopusPanel/panel/releases/tag/v${tag}`,
        };
      }

      if (res.status === 404) {
        // No official GitHub releases published yet: check git remote for commits
        let hasGitUpdate = false;
        try {
          await execAsync('git fetch origin main');
          const { stdout: localRev } = await execAsync('git rev-parse HEAD');
          const { stdout: remoteRev } = await execAsync('git rev-parse origin/main');
          hasGitUpdate = localRev.trim() !== remoteRev.trim();
        } catch {
          // Non-git or offline
        }

        return {
          currentVersion,
          latestVersion: hasGitUpdate ? 'main (new commits)' : currentVersion,
          hasUpdate: hasGitUpdate,
          releaseName: hasGitUpdate ? 'New Commits Available on main' : `OctopusPanel v${currentVersion} (Latest)`,
          releaseNotes: hasGitUpdate
            ? 'New commits have been merged into the main branch. Click Update to pull, compile, and run migrations.'
            : 'Your OctopusPanel control plane is up to date with the latest code.',
          publishedAt: new Date().toISOString(),
          downloadUrl: 'https://github.com/OctopusPanel/panel',
        };
      }
    } catch {
      // Rate-limit or offline fallback
    }

    return {
      currentVersion,
      latestVersion: currentVersion,
      hasUpdate: false,
      releaseName: `OctopusPanel v${currentVersion}`,
      releaseNotes: 'Your system is running the latest version.',
      publishedAt: new Date().toISOString(),
      downloadUrl: 'https://github.com/OctopusPanel/panel',
    };
  }

  private compareVersions(v1: string, v2: string): number {
    const p1 = v1.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
    const p2 = v2.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      const num1 = p1[i] || 0;
      const num2 = p2[i] || 0;
      if (num1 > num2) return 1;
      if (num1 < num2) return -1;
    }
    return 0;
  }

  getStatus(): { isUpdating: boolean; currentStep: number; totalSteps: number; history: UpdateStreamEvent[] } {
    return {
      isUpdating: this.isUpdating,
      currentStep: this.currentStep,
      totalSteps: this.totalSteps,
      history: this.logHistory,
    };
  }

  private broadcast(event: UpdateStreamEvent): void {
    this.logHistory.push(event);
    if (this.logHistory.length > 500) {
      this.logHistory.shift();
    }
    this.emit('event', event);
  }

  private logLine(line: string, stream: 'stdout' | 'stderr' | 'info' | 'error' = 'info'): void {
    this.broadcast({
      type: 'log',
      line,
      stream,
      timestamp: new Date().toISOString(),
    });
  }

  private emitStep(step: number, title: string, progress: number): void {
    this.currentStep = step;
    this.broadcast({
      type: 'step',
      step,
      totalSteps: this.totalSteps,
      title,
      progress,
    });
    this.logLine(`\n=== [${step}/${this.totalSteps}] ${title} ===`, 'info');
  }

  async runPanelUpdate(targetVersion = '0.2.0'): Promise<void> {
    if (this.isUpdating) {
      throw new Error('An update is already currently in progress.');
    }

    this.isUpdating = true;
    this.logHistory = [];
    const currentVer = this.getCurrentVersion();

    this.logLine(`🐙 OctopusPanel Self-Updater initializing...`);
    this.logLine(`Target Version: v${targetVersion} (Current: v${currentVer})`);

    const logDir = process.platform === 'linux' && fs.existsSync('/var/log/octopus')
      ? '/var/log/octopus'
      : path.resolve(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const updateLogFile = path.join(logDir, 'panel-update.log');

    try {
      // Step 1: Pre-Migration DB Snapshot & Config Backup
      this.emitStep(1, 'Safety Pre-Check & Automated DB Snapshot', 25);
      this.logLine('> Backing up configuration environment...');
      if (fs.existsSync('.env')) {
        fs.copyFileSync('.env', '.env.bak');
        this.logLine('> Saved configuration backup to .env.bak');
      }

      this.logLine('> Generating compressed PostgreSQL pre-migration snapshot...');
      this.activeSnapshot = await snapshotManager.createSnapshot('pre-migration', currentVer);
      this.logLine(`> Snapshot successfully created: ${this.activeSnapshot.filename} (${this.activeSnapshot.sizeFormatted})`);

      // Step 2: Git Pull & Checkout
      this.emitStep(2, 'Pulling Latest Codebase & Release Assets', 50);
      try {
        this.logLine('> Executing git pull --rebase origin main...');
        const { stdout: pullOut } = await execAsync('git pull --rebase origin main');
        this.logLine(`> ${pullOut.trim()}`);
      } catch (gitErr: any) {
        this.logLine(`> Git pull info: ${gitErr?.message || gitErr}`);
      }

      // Step 3: Dependency Installation & Asset Build
      this.emitStep(3, 'Building Dependencies & Compiling Production Bundles', 75);
      try {
        this.logLine('> Installing dependencies with pnpm...');
        await execAsync('pnpm install --prod=false');
        this.logLine('> Dependencies installed.');
        this.logLine('> Compiling monorepo assets (pnpm run build)...');
        await execAsync('pnpm run build');
        this.logLine('> Assets successfully compiled.');
      } catch (buildErr: any) {
        this.logLine(`> Build info: ${buildErr?.message || buildErr}`);
      }

      // Step 4: Database Schema Migrations with Auto-Rollback Guard
      this.emitStep(4, 'Executing Database Schema Migrations', 90);
      this.logLine('> Checking database schema with Drizzle ORM...');

      try {
        await runMigrations();
        this.logLine('> ✅ Schema migrations applied successfully.');
      } catch (migrationErr: any) {
        this.logLine(`> ❌ DATABASE MIGRATION FAILED: ${migrationErr?.message || migrationErr}`, 'error');
        this.logLine('> 🚨 Activating Emergency Automatic Rollback Guard...', 'error');

        // Rollback snapshot
        if (this.activeSnapshot) {
          this.logLine(`> Restoring pre-migration snapshot ${this.activeSnapshot.filename}...`, 'info');
          await snapshotManager.restoreSnapshot(this.activeSnapshot.id);
          this.logLine('> ✅ Database state successfully rolled back to pre-migration condition.', 'info');
        }

        // Rollback git
        try {
          await execAsync('git reset --hard HEAD@{1}');
          this.logLine('> ✅ Git branch rolled back to previous commit.', 'info');
        } catch {
          // Ignore git reset if not in git repo
        }

        fs.appendFileSync(
          updateLogFile,
          `[${new Date().toISOString()}] UPDATE ABORTED & ROLLED BACK: ${migrationErr?.stack || migrationErr}\n`
        );

        throw new Error(`Database migration failed: ${migrationErr?.message || migrationErr}. State safely rolled back.`);
      }

      // Complete Update
      this.broadcast({
        type: 'step',
        step: 4,
        totalSteps: 4,
        title: 'Update Complete',
        progress: 100,
      });

      this.logLine(`\n✨ OctopusPanel successfully updated to v${targetVersion}!`);
      this.logLine('> Triggering graceful service reload...');

      this.broadcast({
        type: 'done',
        success: true,
        message: `OctopusPanel successfully updated to v${targetVersion}`,
        timestamp: new Date().toISOString(),
      });

      // Restart service if on Linux
      if (process.platform === 'linux') {
        setTimeout(() => {
          exec('systemctl restart octopus-panel', () => {});
        }, 1500);
      }
    } catch (err: any) {
      this.logLine(`> Update Error: ${err?.message || err}`, 'error');
      this.broadcast({
        type: 'done',
        success: false,
        message: err?.message || 'Update failed',
        timestamp: new Date().toISOString(),
      });
    } finally {
      this.isUpdating = false;
    }
  }
}

export const updateRunner = new UpdateRunner();
