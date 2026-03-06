// notifications.js — OneSignal Web Push for tbd.codes
//
// ONE-TIME SETUP (author):
//   1. Create a free account at onesignal.com → New App → Web Push
//   2. Set Site URL to https://tbd.codes, Auto-resubscribe ON
//   3. Upload icon if desired, finish setup
//   4. Copy App ID from Settings → Keys & IDs → fill in below
//   5. Copy REST API Key → add as GitHub secret ONESIGNAL_API_KEY
//   6. Add App ID as GitHub secret ONESIGNAL_APP_ID (also used by the workflow)

const ONESIGNAL_APP_ID = "c3118b25-905b-41f4-a2ca-846d3fe8e073";

window.OneSignalDeferred = window.OneSignalDeferred || [];
OneSignalDeferred.push(async function (OneSignal) {
  await OneSignal.init({
    appId: ONESIGNAL_APP_ID,
    notifyButton: { enable: false },    // use our own button
    allowLocalhostAsSecureOrigin: true, // lets local dev work over http
  });

  const btn = document.getElementById("notifications-btn");
  if (!btn) return;

  async function syncBtn() {
    const subscribed = !!OneSignal.User.PushSubscription.optedIn;
    btn.textContent = subscribed ? "🔕 Unsubscribe" : "🔔 Subscribe";
    btn.disabled = false;
    btn.classList.remove("hidden");
  }

  await syncBtn();
  OneSignal.User.PushSubscription.addEventListener("change", syncBtn);

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    if (OneSignal.User.PushSubscription.optedIn) {
      await OneSignal.User.PushSubscription.optOut();
    } else {
      await OneSignal.Notifications.requestPermission();
    }
    await syncBtn();
  });
});
