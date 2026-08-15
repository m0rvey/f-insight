import { BackgroundMessageHandler } from './messageHandler';

const handler = new BackgroundMessageHandler();

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[f-insight:Background] Extension installed/updated:', details.reason);
  await handler.init();
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('[f-insight:Background] Extension started');
  await handler.init();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handler.handleMessage(message, sender).then(sendResponse);
  return true; // Keep channel open for async response
});

// Set up periodic cache cleanup alarm (every 30 mins)
chrome.alarms.create('cache_cleanup', { periodInMinutes: 30 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'cache_cleanup') {
    console.log('[f-insight:Background] Running scheduled cache cleanup...');
  }
});
