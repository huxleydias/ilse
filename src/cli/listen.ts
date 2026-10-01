import chalk from 'chalk';
import { startServer, getPort } from '../bridge/ws-server.js';
import { listAnnotations, getStats, resolveAnnotation } from '../bridge/store.js';
import { t } from '../i18n/index.js';
import type { Annotation } from '../types.js';

function formatAnnotation(a: Annotation): string {
  const lines: string[] = [];

  // Header
  lines.push(chalk.cyan(`  [${a.id}]`) + ' ' + chalk.white(a.element));
  if (a.component) lines.push(chalk.dim(`  Component: ${a.component}`));
  if (a.componentStack?.length) lines.push(chalk.dim(`  Stack: ${a.componentStack.join(' → ')}`));
  if (a.note) lines.push(`  ${chalk.yellow('"' + a.note + '"')}`);

  // Position & DOM
  if (a.position) lines.push(chalk.dim(`  Position: x:${a.position.left}, y:${a.position.top} (${a.position.width}×${a.position.height}px)`));
  if (a.domPath) lines.push(chalk.dim(`  DOM Path: ${a.domPath}`));
  if (a.grepPattern) lines.push(chalk.dim(`  Grep: ${a.grepPattern}`));
  if (a.nearbyElements?.length) lines.push(chalk.dim(`  Nearby: ${a.nearbyElements.join(', ')}`));
  if (a.parent) lines.push(chalk.dim(`  Parent: ${a.parent}`));

  // Styles (condensed)
  const styleKeys = Object.keys(a.styles);
  if (styleKeys.length > 0) {
    const condensed = styleKeys.slice(0, 8).map(k => `${k}: ${a.styles[k]}`).join(', ');
    const suffix = styleKeys.length > 8 ? ` (+${styleKeys.length - 8} more)` : '';
    lines.push(chalk.dim(`  Styles: ${condensed}${suffix}`));
  }

  // Environment
  if (a.environment) {
    lines.push(chalk.dim(`  Env: ${a.environment.viewport} · DPR ${a.environment.devicePixelRatio} · ${a.environment.url}`));
  }

  return lines.join('\n');
}

export async function listenCommand(options: { port?: number } = {}) {
  const port = options.port ?? getPort();

  const server = await startServer({
    port,
    onAnnotation: (annotation) => {
      console.log(formatAnnotation(annotation));
      console.log('');
    },
    onBatch: (annotations) => {
      console.log(chalk.bold(`  ${t('listen.batch', { count: annotations.length })}`));
      for (const a of annotations) {
        console.log(formatAnnotation(a));
      }
      console.log('');
    },
  });

  const activePort = server ? getPort() : null;

  console.log('');
  console.log(chalk.bold('  ilse listen'));
  if (!server) {
    console.log(chalk.red(`  ✗ ${t('cli.noPort')}`));
    process.exit(1);
  }
  console.log(chalk.dim(`  ws://localhost:${activePort}`));
  console.log('');
  console.log(chalk.dim(`  ${t('listen.waiting')}`));
  console.log('');

  // Keep alive
  await new Promise(() => {});
}

export function annotationsCommand(options: { status?: string } = {}) {
  const filter = options.status ? { status: options.status as Annotation['status'] } : undefined;
  const annotations = listAnnotations(filter);
  const stats = getStats();

  console.log('');
  console.log(chalk.bold(`  ${t('listen.totalAnnotations', { total: stats.total })}`) + chalk.dim(` (${stats.pending} pending, ${stats.sent} sent, ${stats.resolved} resolved)`));
  console.log('');

  if (annotations.length === 0) {
    console.log(chalk.dim(`  ${t('listen.noneFound')}`));
    console.log('');
    return;
  }

  for (const a of annotations) {
    const statusColor = a.status === 'pending' ? chalk.yellow : a.status === 'sent' ? chalk.blue : chalk.green;
    console.log(`  ${statusColor(a.status.padEnd(8))} ${chalk.cyan(a.id)} ${a.element}`);
    if (a.note) console.log(chalk.dim(`           "${a.note}"`));
    if (a.resolvedSummary) console.log(chalk.green(`           → ${a.resolvedSummary}`));
  }
  console.log('');
}

export function resolveCommand(id: string, options: { summary?: string } = {}) {
  const summary = options.summary ?? t('toolbar.resolved');
  const annotation = resolveAnnotation(id, summary);

  if (!annotation) {
    console.log(chalk.red(`  ${t('listen.notFound', { id })}`));
    return;
  }

  console.log(chalk.green(`  ✓ ${annotation.id} ${t('listen.resolved')}`) + chalk.dim(` — ${summary}`));
}
