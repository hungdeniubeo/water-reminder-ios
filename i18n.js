/**
 * Lightweight UI translations. All text stays local: no translation API or network requests.
 * Add new UI copy to both languages and use translate() for messages created in JavaScript.
 */
export const LANGUAGE_KEY = 'water-reminder-language-v1';
export const LANGUAGES = Object.freeze(['vi', 'en']);

export const messages = {
  vi: {
    documentTitle: 'Water Reminder — Nhắc uống nước',
    pageDescription: 'Một chiếc app nhỏ xinh để ghi lại nước uống mỗi ngày.',
    brandTagline: 'DÀNH CHO EM ♡',
    aboutButton: 'Cách cài ứng dụng lên iPhone',
    languageLabel: 'Chọn ngôn ngữ',
    todayTitle: 'Uống đủ nước,|thương mình hơn.',
    todaySubtitle: 'Một chút quan tâm, mỗi ngày một lần.',
    todayWater: 'LƯỢNG NƯỚC HÔM NAY',
    onYourWay: 'CỐ LÊN NÀO ♡',
    goalReached: 'ĐÃ ĐẠT MỤC TIÊU ♡',
    progressAria: 'Tiến độ uống nước hôm nay',
    consumedUnit: 'ml đã uống',
    goalOf: 'mục tiêu {amount} ml',
    startFresh: 'Bắt đầu một ngày mới nhé ♡',
    startingWell: 'Khởi đầu tốt rồi đó!',
    halfWay: 'Sắp đạt mục tiêu rồi!',
    reachedToday: 'Giỏi quá, đạt mục tiêu rồi ♡',
    remaining: 'Còn {amount} ml để đạt mục tiêu',
    completed: 'Hôm nay bạn đã uống đủ mục tiêu.',
    logDrink: 'Thêm nước',
    quickAdd: 'Thêm nhanh',
    quickSub: 'LƯỢNG THƯỜNG UỐNG',
    todaySips: 'Đã uống hôm nay',
    entryCount: '{count} LẦN',
    emptyTitle: 'Hôm nay chưa có lần uống nào',
    emptyDescription: 'Ghi lại ly nước đầu tiên nha.',
    historyEyebrow: 'NHÌN LẠI MỖI NGÀY',
    historyTitle: 'Mỗi ngụm nhỏ,|một thay đổi.',
    historySubtitle: 'Cùng xem thói quen uống nước của bạn.',
    sevenDays: '7 ngày gần đây',
    dailyTotals: 'TỔNG THEO NGÀY',
    averagePerDay: 'TRUNG BÌNH / NGÀY',
    goalDays: 'ĐẠT MỤC TIÊU',
    daysCount: '{count} ngày',
    dayByDay: 'Từng ngày một',
    lastFourteenDays: '14 NGÀY GẦN ĐÂY',
    today: 'Hôm nay',
    yesterday: 'Hôm qua',
    reachedAria: 'Đã đạt mục tiêu',
    removeEntry: 'Xóa lần uống {amount} ml lúc {time}',
    settingsEyebrow: 'CHỈ DÀNH CHO BẠN',
    settingsTitle: 'Theo nhịp riêng|của mình.',
    settingsSubtitle: 'Điều chỉnh một chút cho vừa với ngày của bạn.',
    dailyGoal: 'Mục tiêu mỗi ngày',
    dailyGoalDescription: 'Chọn lượng nước bạn muốn theo dõi.',
    goalField: 'Mục tiêu (ml)',
    saveGoal: 'Lưu mục tiêu',
    goalNote: 'Từ 500 đến 6.000 ml. Đây là mục tiêu cá nhân, không phải tư vấn y tế.',
    reminders: 'Nhắc uống nước',
    reminderDescription: 'Nhắc nhẹ khi ứng dụng đang mở.',
    enableReminders: 'Bật nhắc nhở',
    from: 'Từ',
    until: 'Đến',
    every: 'Nhắc sau mỗi',
    interval60: '1 giờ',
    interval90: '1 giờ 30 phút',
    interval120: '2 giờ',
    interval180: '3 giờ',
    preview: 'Lịch nhắc: {times}{more}',
    previewInvalid: 'Giờ bắt đầu phải sớm hơn giờ kết thúc.',
    saveReminders: 'Lưu lịch nhắc',
    reminderNoteTitle: 'Lưu ý nho nhỏ',
    reminderNote: 'Phiên bản hiện tại chỉ hiện lời nhắc khi app đang mở. Thông báo trên màn hình khóa khi đóng app sẽ được bổ sung sau.',
    privacyTitle: 'Riêng tư cho bạn',
    privacyDescription: 'Dữ liệu được lưu trên thiết bị này.',
    privacyNote: 'Không cần tài khoản, không theo dõi và không đồng bộ. Xóa dữ liệu Safari hoặc gỡ app có thể làm mất lịch sử.',
    backupTitle: 'Giữ lại kỷ niệm nhỏ',
    backupDescription: 'Lưu một bản dữ liệu phòng khi cần.',
    exportData: 'Xuất dữ liệu',
    restoreFile: 'Khôi phục',
    backupAria: 'Chọn tệp sao lưu JSON',
    backupNote: 'Khôi phục sẽ thay thế dữ liệu và cài đặt hiện có. Tệp chỉ được đọc trên máy, không tải lên mạng.',
    version: 'WATER REMINDER · PHIÊN BẢN 1.1',
    navAria: 'Điều hướng chính',
    tabToday: 'Hôm nay',
    tabHistory: 'Lịch sử',
    tabSettings: 'Cài đặt',
    dialogEyebrow: 'NHỚ UỐNG NƯỚC NHÉ ♡',
    close: 'Đóng',
    drinkTitle: 'Bạn vừa uống bao nhiêu?',
    drinkSubtitle: 'Dù một ngụm nhỏ cũng đáng nhớ.',
    presetAria: 'Chọn lượng nước',
    customAmount: 'Hoặc nhập số ml',
    addToday: 'Thêm vào hôm nay',
    aboutEyebrow: 'LUÔN BÊN BẠN',
    aboutTitle: 'Cài app lên màn hình chính',
    aboutBody: 'Mở trang này bằng <strong>Safari</strong> trên iPhone, nhấn <strong>Chia sẻ</strong> → <strong>Thêm vào Màn hình chính</strong>. Sau đó mở Water từ biểu tượng mới.',
    aboutNote: 'Sau lần mở đầu tiên có mạng, app có thể sử dụng offline. Dữ liệu được lưu trên máy của bạn.',
    gotIt: 'Mình hiểu rồi',
    undo: 'Hoàn tác',
    amountInvalid: 'Nhập lượng nước từ 20 đến 2.000 ml nhé.',
    waterAdded: 'Đã thêm {amount} ml ♡',
    entryRemoved: 'Đã xóa một lần uống.',
    entryRestored: 'Đã khôi phục lần uống.',
    storageProblem: 'Không thể lưu dữ liệu. Hãy kiểm tra bộ nhớ thiết bị.',
    goalInvalid: 'Mục tiêu phải từ 500 đến 6.000 ml.',
    goalUpdated: 'Đã lưu mục tiêu mới!',
    timeInvalid: 'Giờ kết thúc cần sau giờ bắt đầu.',
    remindersSaved: 'Đã lưu lời nhắc trong app.',
    remindersOff: 'Đã tắt nhắc nhở.',
    reminderToast: 'Tới giờ uống chút nước rồi ♡',
    backupReady: 'Đã tạo bản sao lưu. Nhớ lưu tệp ở nơi an toàn nhé.',
    backupTooLarge: 'Tệp sao lưu quá lớn.',
    backupInvalid: 'Đây không phải tệp sao lưu Water Reminder.',
    backupConfirm: 'Thay thế lịch sử uống nước và cài đặt hiện có bằng bản sao lưu này?',
    backupRestored: 'Đã khôi phục dữ liệu thành công!',
    backupFailed: 'Không thể mở tệp sao lưu.'
  },
  en: {
    documentTitle: 'Water Reminder — Your daily sip',
    pageDescription: 'A little water tracker made with care. Log your drinks and build a daily habit.',
    brandTagline: 'JUST FOR YOU ♡',
    aboutButton: 'How to install Water on your iPhone',
    languageLabel: 'Choose a language',
    todayTitle: 'A little water,|a little love.',
    todaySubtitle: 'A gentle reminder to take care of yourself.',
    todayWater: "TODAY'S WATER",
    onYourWay: 'YOU GOT THIS ♡',
    goalReached: 'GOAL REACHED ♡',
    progressAria: 'Daily water progress',
    consumedUnit: 'ml enjoyed',
    goalOf: 'of {amount} ml',
    startFresh: 'A fresh start, just for you ♡',
    startingWell: 'Off to a lovely start!',
    halfWay: 'Almost there!',
    reachedToday: 'Goal reached. Look at you! ♡',
    remaining: '{amount} ml to your goal',
    completed: 'You have met your goal today.',
    logDrink: 'Log a drink',
    quickAdd: 'Quick add',
    quickSub: 'YOUR USUAL AMOUNTS',
    todaySips: "Today's sips",
    entryCount: '{count} {count,plural,entry,entries}',
    emptyTitle: 'Nothing logged yet today',
    emptyDescription: 'Your first glass is just a tap away.',
    historyEyebrow: 'YOUR EVERYDAY STORY',
    historyTitle: 'Little sips,|lovely progress.',
    historySubtitle: "Here's how your hydration has been going.",
    sevenDays: 'Last 7 days',
    dailyTotals: 'DAILY TOTALS',
    averagePerDay: 'AVERAGE / DAY',
    goalDays: 'GOAL REACHED',
    daysCount: '{count} {count,plural,day,days}',
    dayByDay: 'Day by day',
    lastFourteenDays: 'LAST 14 DAYS',
    today: 'Today',
    yesterday: 'Yesterday',
    reachedAria: 'Goal reached',
    removeEntry: 'Delete {amount} ml entry at {time}',
    settingsEyebrow: 'JUST THE WAY YOU LIKE IT',
    settingsTitle: 'Your pace.|Your way.',
    settingsSubtitle: 'Little settings to fit your day.',
    dailyGoal: 'Daily water goal',
    dailyGoalDescription: 'Choose a target that feels right for you.',
    goalField: 'Your daily goal (ml)',
    saveGoal: 'Save goal',
    goalNote: 'Set between 500 and 6,000 ml. This is a personal tracking target, not medical advice.',
    reminders: 'Gentle reminders',
    reminderDescription: 'A little nudge while Water is open.',
    enableReminders: 'Enable reminders',
    from: 'From',
    until: 'Until',
    every: 'Remind me every',
    interval60: '1 hour',
    interval90: '1.5 hours',
    interval120: '2 hours',
    interval180: '3 hours',
    preview: 'Preview: {times}{more}',
    previewInvalid: 'Choose a start time earlier than your end time.',
    saveReminders: 'Save reminder settings',
    reminderNoteTitle: 'A little heads-up',
    reminderNote: "This version shows reminders only while the app is open. Lock-screen notifications when it's closed are planned for later.",
    privacyTitle: 'Private by design',
    privacyDescription: 'Your logs stay on this device.',
    privacyNote: 'No account, analytics, or cloud sync. Clearing Safari data or removing the app may erase your history.',
    backupTitle: 'Keep a little backup',
    backupDescription: 'Save your entries as a file, just in case.',
    exportData: 'Export data',
    restoreFile: 'Restore file',
    backupAria: 'Choose a JSON backup file',
    backupNote: 'Restoring replaces your current entries and settings. Nothing is uploaded.',
    version: 'WATER REMINDER · VERSION 1.1',
    navAria: 'Main navigation',
    tabToday: 'Today',
    tabHistory: 'History',
    tabSettings: 'Settings',
    dialogEyebrow: 'A LITTLE SIP GOES A LONG WAY ♡',
    close: 'Close',
    drinkTitle: 'How much did you drink?',
    drinkSubtitle: 'Every little sip counts.',
    presetAria: 'Choose an amount of water',
    customAmount: 'Or enter an amount (ml)',
    addToday: 'Add to today',
    aboutEyebrow: 'KEEP WATER CLOSE',
    aboutTitle: 'Add to your Home Screen',
    aboutBody: 'Open this page in <strong>Safari</strong> on your iPhone. Tap <strong>Share</strong> → <strong>Add to Home Screen</strong>. Then launch Water from its new icon.',
    aboutNote: 'After your first online visit, Water can work offline. Everything you log stays on your device.',
    gotIt: 'Got it',
    undo: 'Undo',
    amountInvalid: 'Enter an amount between 20 and 2,000 ml.',
    waterAdded: '+{amount} ml added ♡',
    entryRemoved: 'Entry removed.',
    entryRestored: 'Entry restored.',
    storageProblem: 'Unable to save data. Check your device storage.',
    goalInvalid: 'Choose a goal between 500 and 6,000 ml.',
    goalUpdated: 'Daily goal updated!',
    timeInvalid: 'End time must be later than start time.',
    remindersSaved: 'In-app reminders saved.',
    remindersOff: 'Reminders turned off.',
    reminderToast: 'A little water break? Take a sip ♡',
    backupReady: 'Backup prepared. Save it somewhere safe.',
    backupTooLarge: 'Backup file is too large.',
    backupInvalid: 'This is not a Water Reminder backup.',
    backupConfirm: 'Replace your current water history and settings with this backup?',
    backupRestored: 'Your backup has been restored!',
    backupFailed: 'Could not open this backup.'
  }
};

export function getLanguage(storage = typeof localStorage === 'undefined' ? null : localStorage) {
  try {
    const stored = storage?.getItem(LANGUAGE_KEY);
    return LANGUAGES.includes(stored) ? stored : 'vi';
  } catch {
    return 'vi';
  }
}

export function setLanguage(language, storage = typeof localStorage === 'undefined' ? null : localStorage) {
  if (!LANGUAGES.includes(language)) return false;
  try { storage?.setItem(LANGUAGE_KEY, language); } catch { /* non-persistent session */ }
  return true;
}

export function translate(key, language = 'vi', variables = {}) {
  const dict = messages[LANGUAGES.includes(language) ? language : 'vi'];
  let text = dict[key] ?? messages.en[key] ?? key;
  text = text.replace(/\{(\w+),plural,([^,{}]+),([^{}]+)\}/g, (_, name, singular, plural) => Number(variables[name]) === 1 ? singular : plural);
  return text.replace(/\{(\w+)\}/g, (_, name) => String(variables[name] ?? ''));
}

export function formatNumber(number, language = 'vi') {
  return Number(number).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US');
}

export function formatDate(date, language = 'vi', options = {}) {
  return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', options).format(date);
}

export function formatTime(date, language = 'vi') {
  return formatDate(date, language, language === 'vi' ? { hour: '2-digit', minute: '2-digit', hour12: false } : { hour: 'numeric', minute: '2-digit' });
}

export function applyTranslations(language = 'vi', doc = document) {
  const t = (key, variables) => translate(key, language, variables);
  doc.documentElement.lang = language;
  doc.title = t('documentTitle');
  doc.querySelector('meta[name="description"]')?.setAttribute('content', t('pageDescription'));
  doc.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = t(node.dataset.i18n); });
  // HTML values come exclusively from the static, developer-owned translation dictionary.
  doc.querySelectorAll('[data-i18n-html]').forEach(node => { node.innerHTML = t(node.dataset.i18nHtml); });
  doc.querySelectorAll('[data-i18n-heading]').forEach(node => {
    const [first, second] = t(node.dataset.i18nHeading).split('|');
    node.replaceChildren(doc.createTextNode(first), doc.createElement('br'));
    const emphasized = doc.createElement('em');
    emphasized.textContent = second;
    node.append(emphasized);
  });
  doc.querySelectorAll('[data-i18n-aria-label]').forEach(node => { node.setAttribute('aria-label', t(node.dataset.i18nAriaLabel)); });
  doc.querySelectorAll('[data-i18n-title]').forEach(node => { node.setAttribute('title', t(node.dataset.i18nTitle)); });
  doc.querySelectorAll('[data-lang]').forEach(node => {
    const selected = node.dataset.lang === language;
    node.classList.toggle('selected', selected);
    node.setAttribute('aria-pressed', String(selected));
  });
}
