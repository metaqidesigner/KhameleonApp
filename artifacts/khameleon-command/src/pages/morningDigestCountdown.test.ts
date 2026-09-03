// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GeneralSection } from './settings';
import { AutoTriggers } from './tasks';
import { getSchedulerStatus } from '@/lib/jarvisApi';

vi.mock('@/lib/jarvisApi', () => ({
  createTask: vi.fn(),
  deleteTask: vi.fn(),
  getHealth: vi.fn(),
  getSchedulerStatus: vi.fn(),
  getTasks: vi.fn(),
  updateTask: vi.fn(),
}));

vi.mock('@/lib/taskRunApi', () => ({
  cancelTaskRun: vi.fn(),
  getTaskRuns: vi.fn().mockResolvedValue([]),
  retryTaskRun: vi.fn(),
  streamTaskRun: vi.fn(() => () => {}),
  submitCommand: vi.fn(),
}));

vi.mock('@/lib/agentsApi', () => ({
  streamAgentChat: vi.fn(),
}));

const schedulerStatus = {
  enabled: true,
  digestHour: 7,
  digestMinute: 0,
  nextRunAt: '2026-08-19T08:30:00.000Z',
  lastRunAt: null,
};

const schedulerStatusMock = vi.mocked(getSchedulerStatus);
let mountedRoot: Root | undefined;

async function flushSchedulerResponse() {
  await act(async () => {
    await Promise.resolve();
  });
}

function mount(element: ReturnType<typeof createElement>) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  mountedRoot = createRoot(container);
  act(() => {
    mountedRoot?.render(element);
  });
  return container;
}

function exactText(container: HTMLElement, text: string) {
  return Array.from(container.querySelectorAll<HTMLElement>('*')).find(
    element => element.children.length === 0 && element.textContent === text,
  );
}

describe('morning digest countdowns', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-19T07:00:00.000Z'));
    schedulerStatusMock.mockResolvedValue(schedulerStatus);
  });

  afterEach(async () => {
    await act(async () => {
      mountedRoot?.unmount();
    });
    mountedRoot = undefined;
    document.body.replaceChildren();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('refreshes the Settings countdown after one minute without polling again', async () => {
    const container = mount(createElement(GeneralSection));
    await flushSchedulerResponse();

    expect(container.textContent).toContain('in 1h 30m');
    expect(schedulerStatusMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    expect(container.textContent).toContain('in 1h 29m');
    expect(schedulerStatusMock).toHaveBeenCalledTimes(1);
  });

  it('refreshes the Tasks auto-trigger countdown after one minute without polling again', async () => {
    const container = mount(createElement(AutoTriggers));
    await flushSchedulerResponse();
    const triggerLabel = exactText(container, 'AUTO TRIGGERS');
    if (!triggerLabel?.parentElement) throw new Error('Auto-trigger header was not rendered');

    await act(async () => {
      triggerLabel.parentElement?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('⏰ in 1h 30m');
    expect(schedulerStatusMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    expect(container.textContent).toContain('⏰ in 1h 29m');
    expect(schedulerStatusMock).toHaveBeenCalledTimes(1);
  });
});