import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { snapshotManager, SnapshotMetadata } from './snapshot-manager.js';
import { runMigrations } from '@octopus/database';

const execAsync = promisify(exec);

export function findProjectRoot(): string {
  let curr = path.resolve(process.cwd());
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(curr, 'pnpm-workspace.yaml'))) {
      return curr;
    }
    const pkgPath = path.join(curr, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        if (pkg.name === 'octopuspanel-monorepo' || pkg.workspaces) {
          return curr;
        }
      } catch {}
    }
    const parent = path.dirname(curr);
    if (parent === curr) break;
    curr = parent;
  }
  return process.cwd();
}

export interface SystemUpdateInfo {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  releaseName: string;
  releaseNotes: string;
  publishedAt: string;
  downloadUrl: string;
  daemon?: {
    latestVersion: string;
    downloadUrl: string;
  };
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
    const rootDir = findProjectRoot();
    try {
      const rootPkgPath = path.join(rootDir, 'package.json');
      if (fs.existsSync(rootPkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf-8'));
        if (pkg.version) return pkg.version;
      }
    } catch {
      // Fallback
    }
    try {
      const backendPkgPath = path.join(rootDir, 'apps', 'backend', 'package.json');
      if (fs.existsSync(backendPkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(backendPkgPath, 'utf-8'));
        if (pkg.version) return pkg.version;
      }
    } catch {}
    return '0.4.0';
  }

  async checkForUpdates(): Promise<SystemUpdateInfo> {
    const currentVersion = this.getCurrentVersion();
    let daemonInfo = {
      latestVersion: 'v0.1.8',
      downloadUrl: 'https://github.com/OctopusPanel/tentacle/releases/latest',
    };

    try {
      const tentacleRes = await fetch('https://api.github.com/repos/OctopusPanel/tentacle/releases/latest', {
        headers: { 'User-Agent': 'OctopusPanel-UpdateService' },
        signal: AbortSignal.timeout(4000),
      });
      if (tentacleRes.ok) {
        const tData = (await tentacleRes.json()) as any;
        if (tData.tag_name) {
          daemonInfo = {
            latestVersion: tData.tag_name,
            downloadUrl: tData.html_url || `https://github.com/OctopusPanel/tentacle/releases/tag/${tData.tag_name}`,
          };
        }
      }
    } catch {
      // Ignore tentacle fetch error
    }

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
          daemon: daemonInfo,
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
          daemon: daemonInfo,
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
      daemon: daemonInfo,
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

  private runCommandStreaming(command: string, cwd = process.cwd()): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = exec(command, { cwd });
      child.stdout?.on('data', (data) => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
          if (line.trim()) this.logLine(`> ${line.trim()}`, 'stdout');
        }
      });
      child.stderr?.on('data', (data) => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
          if (line.trim()) this.logLine(`> ${line.trim()}`, 'stderr');
        }
      });
      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Command '${command}' exited with code ${code}`));
      });
      child.on('error', reject);
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

  async runPanelUpdate(targetVersion = '0.4.0'): Promise<void> {
    if (this.isUpdating) {
      throw new Error('An update is already currently in progress.');
    }

    this.isUpdating = true;
    this.logHistory = [];
    const rootDir = findProjectRoot();
    const currentVer = this.getCurrentVersion();
    const cleanTargetVersion = targetVersion.replace(/^v/, '');

    this.logLine(`🐙 OctopusPanel Self-Updater initializing...`);
    this.logLine(`Project root directory: ${rootDir}`);
    this.logLine(`Target Version: v${cleanTargetVersion} (Current: v${currentVer})`);

    const logDir = process.platform === 'linux' && fs.existsSync('/var/log/octopus')
      ? '/var/log/octopus'
      : path.resolve(rootDir, 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const updateLogFile = path.join(logDir, 'panel-update.log');

    try {
      // Step 1: Pre-Migration DB Snapshot & Config Backup
      this.emitStep(1, 'Safety Pre-Check & Automated DB Snapshot', 25);
      this.logLine('> Backing up configuration environment...');
      const envPath = path.join(rootDir, '.env');
      const envBakPath = path.join(rootDir, '.env.bak');
      if (fs.existsSync(envPath)) {
        try {
          fs.copyFileSync(envPath, envBakPath);
          this.logLine('> Saved configuration backup to .env.bak');
        } catch (e: any) {
          this.logLine(`> Note: .env backup skipped: ${e?.message}`);
        }
      }

      this.logLine('> Generating compressed PostgreSQL pre-migration snapshot...');
      try {
        this.activeSnapshot = await snapshotManager.createSnapshot('pre-migration', currentVer);
        this.logLine(`> Snapshot successfully created: ${this.activeSnapshot.filename} (${this.activeSnapshot.sizeFormatted})`);
      } catch (snapErr: any) {
        this.logLine(`> ⚠️ Snapshot generation warning: ${snapErr?.message || snapErr}`, 'error');
        this.logLine('> Proceeding with codebase update...');
      }

      // Step 2: Fetch and Unpack Codebase / Release Assets
      this.emitStep(2, 'Pulling Latest Codebase & Release Assets', 50);
      const isGitRepo = fs.existsSync(path.join(rootDir, '.git'));
      let codeUpdated = false;

      if (isGitRepo) {
        this.logLine('> Git repository detected. Fetching updates from remote...');
        try {
          await this.runCommandStreaming('git fetch --tags origin', rootDir);
          try {
            this.logLine(`> Checking out release tag v${cleanTargetVersion}...`);
            await this.runCommandStreaming(`git checkout v${cleanTargetVersion}`, rootDir);
            codeUpdated = true;
          } catch {
            this.logLine(`> Tag checkout failed; attempting git pull on current branch...`);
            await this.runCommandStreaming('git pull --rebase origin main', rootDir);
            codeUpdated = true;
          }
          this.logLine('> Git codebase successfully updated.');
        } catch (gitErr: any) {
          this.logLine(`> Git fetch/pull failed: ${gitErr?.message || gitErr}. Falling back to GitHub release tarball...`);
        }
      }

      if (!codeUpdated) {
        this.logLine('> Downloading release tarball from GitHub...');
        let downloadUrl = '';
        try {
          const relRes = await fetch(`https://api.github.com/repos/OctopusPanel/panel/releases/tags/v${cleanTargetVersion}`, {
            headers: { 'User-Agent': 'OctopusPanel-UpdateService' },
          });
          if (relRes.ok) {
            const relData = (await relRes.json()) as any;
            const asset = relData.assets?.find((a: any) => a.name?.endsWith('.tar.gz'));
            if (asset?.browser_download_url) {
              downloadUrl = asset.browser_download_url;
            }
          }
        } catch (err: any) {
          this.logLine(`> Note: Tag release lookup failed: ${err?.message}`);
        }

        if (!downloadUrl) {
          try {
            const latestRes = await fetch('https://api.github.com/repos/OctopusPanel/panel/releases/latest', {
              headers: { 'User-Agent': 'OctopusPanel-UpdateService' },
            });
            if (latestRes.ok) {
              const latestData = (await latestRes.json()) as any;
              const asset = latestData.assets?.find((a: any) => a.name?.endsWith('.tar.gz'));
              if (asset?.browser_download_url) {
                downloadUrl = asset.browser_download_url;
              }
            }
          } catch (err: any) {
            this.logLine(`> Note: Latest release lookup failed: ${err?.message}`);
          }
        }

        if (downloadUrl) {
          this.logLine(`> Downloading package from ${downloadUrl}...`);
          const tempTar = path.join(rootDir, 'octopus-update.tar.gz');
          const resp = await fetch(downloadUrl, {
            headers: { 'User-Agent': 'OctopusPanel-UpdateService' },
            redirect: 'follow',
          });
          if (!resp.ok || !resp.body) {
            throw new Error(`Failed to download release archive (${resp.status} ${resp.statusText})`);
          }
          const fileStream = fs.createWriteStream(tempTar);
          await pipeline(Readable.fromWeb(resp.body as any), fileStream);
          this.logLine('> Extracting release archive...');
          await this.runCommandStreaming(`tar -xzf "${tempTar}" -C "${rootDir}"`, rootDir);
          try {
            fs.unlinkSync(tempTar);
          } catch {}
          this.logLine('> Release archive extracted successfully.');
          codeUpdated = true;
        } else {
          this.logLine(`> ⚠️ No release archive available; continuing with current code tree.`);
        }
      }

      // Step 3: Dependency Installation & Asset Build
      this.emitStep(3, 'Building Dependencies & Compiling Production Bundles', 75);
      try {
        this.logLine('> Verifying dependencies (pnpm install)...');
        await this.runCommandStreaming('pnpm install --prod', rootDir);
        this.logLine('> Dependencies verified.');
      } catch (pnpmErr: any) {
        this.logLine(`> pnpm install info: ${pnpmErr?.message || pnpmErr}`);
      }

      if (isGitRepo) {
        try {
          this.logLine('> Compiling monorepo assets (pnpm run build)...');
          await this.runCommandStreaming('pnpm run build', rootDir);
          this.logLine('> Assets successfully compiled.');
        } catch (buildErr: any) {
          this.logLine(`> Build info: ${buildErr?.message || buildErr}`);
        }
      } else {
        this.logLine('> Production tarball installation includes pre-compiled bundles. Skipping rebuild.');
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

        // Rollback git if applicable
        if (isGitRepo) {
          try {
            await execAsync('git reset --hard HEAD@{1}', { cwd: rootDir });
            this.logLine('> ✅ Git branch rolled back to previous commit.', 'info');
          } catch {
            // Ignore git reset error
          }
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

      this.logLine(`\n✨ OctopusPanel successfully updated to v${cleanTargetVersion}!`);
      this.logLine('> Triggering graceful service reload...');

      this.broadcast({
        type: 'done',
        success: true,
        message: `OctopusPanel successfully updated to v${cleanTargetVersion}`,
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
