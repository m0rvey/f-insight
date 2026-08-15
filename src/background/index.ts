import { BackgroundMessageHandler } from './messageHandler';
import { cacheManager } from '../services/cacheManager';

const handler = new BackgroundMessageHandler();

const ensureCleanupAlarm = () => {
  // Only create once — module-scope creation would reset the 30-min countdown
  // on every service-worker wake.
  chrome.alarms.create('cache_cleanup', { periodInMinutes: 30 });
};

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[f-insight:Background] Extension installed/updated:', details.reason);
  ensureCleanupAlarm();
  await handler.init();
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('[f-insight:Background] Extension started');
  ensureCleanupAlarm();
  await handler.init();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handler.init().then(() => handler.handleMessage(message, sender)).then(sendResponse);
  return true; // Keep channel open for async response
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'cache_cleanup') {
    console.log('[f-insight:Background] Running scheduled cache cleanup...');
    await cacheManager.cleanup();
  }
});
