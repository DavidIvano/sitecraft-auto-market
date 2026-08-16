import { EU_WAVE_LOCALES, translateEuWaveData } from "./euWaveCoreTranslations.ts";

export const PUBLIC_STATIC_PAGE_CODES = ["sell", "pricing", "support", "privacy", "impressum"] as const;
export type PublicStaticPageCode = typeof PUBLIC_STATIC_PAGE_CODES[number];

export type PublicStaticPage = {
  title: string;
  description: string;
  heading: string;
  lead: string;
  sections: Array<{ heading: string; body: string }>;
};

const de: Record<PublicStaticPageCode, PublicStaticPage> = {
  sell: {
    title: "Fahrzeug verkaufen",
    description: "Erstellen und veröffentlichen Sie Ihre Fahrzeuganzeige bei SiteCraft Auto Market.",
    heading: "Fahrzeug sicher verkaufen",
    lead: "Fotos und Fahrzeugdaten werden als Entwurf gespeichert und vor der Veröffentlichung geprüft.",
    sections: [{ heading: "Anzeige erstellen", body: "Melden Sie sich an, laden Sie Ihre Fotos hoch und prüfen Sie alle Angaben vor dem Absenden." }],
  },
  pricing: {
    title: "Preise",
    description: "Preise und optionale Leistungen von SiteCraft Auto Market.",
    heading: "Transparente Leistungen",
    lead: "Die Erstellung eines Entwurfs und optionale Hervorhebungen werden vor einer Buchung klar ausgewiesen.",
    sections: [{ heading: "Keine versteckten Kosten", body: "Der endgültige Preis wird angezeigt, bevor Sie eine kostenpflichtige Leistung bestätigen." }],
  },
  support: {
    title: "Support",
    description: "Hilfe und Kontakt für SiteCraft Auto Market.",
    heading: "Wie können wir helfen?",
    lead: "Bei Fragen zu Anzeigen, Konten oder Daten erreichen Sie uns per E-Mail.",
    sections: [{ heading: "Kontakt", body: "Schreiben Sie an ivanovdavid119@gmail.com und nennen Sie nach Möglichkeit die URL oder Anzeigen-ID." }],
  },
  privacy: {
    title: "Datenschutz",
    description: "Datenschutzhinweise für SiteCraft Auto Market.",
    heading: "Datenschutz",
    lead: "Wir verarbeiten nur Daten, die für Konto, Anzeige und sicheren Betrieb erforderlich sind.",
    sections: [
      { heading: "Verarbeitete Daten", body: "Dazu gehören Kontoangaben, Anzeigendaten, hochgeladene Bilder und technisch notwendige Protokolldaten." },
      { heading: "Ihre Rechte", body: "Sie können Auskunft, Berichtigung oder Löschung Ihrer personenbezogenen Daten anfordern." },
    ],
  },
  impressum: {
    title: "Impressum",
    description: "Anbieterinformationen für SiteCraft Auto Market.",
    heading: "Impressum",
    lead: "Informationen zum Anbieter dieses Dienstes.",
    sections: [{ heading: "Kontakt", body: "SiteCraft Agency · E-Mail: ivanovdavid119@gmail.com" }],
  },
};

const en: Record<PublicStaticPageCode, PublicStaticPage> = {
  sell: {
    title: "Sell a vehicle",
    description: "Create and publish your vehicle listing on SiteCraft Auto Market.",
    heading: "Sell your vehicle safely",
    lead: "Photos and vehicle data are saved as a draft and checked before publication.",
    sections: [{ heading: "Create a listing", body: "Sign in, upload your photos, and review every detail before submitting the listing." }],
  },
  pricing: {
    title: "Pricing",
    description: "Pricing and optional services on SiteCraft Auto Market.",
    heading: "Transparent services",
    lead: "Draft creation and optional promotion are clearly explained before any paid action.",
    sections: [{ heading: "No hidden costs", body: "The final price is shown before you confirm a paid service." }],
  },
  support: {
    title: "Support",
    description: "Help and contact information for SiteCraft Auto Market.",
    heading: "How can we help?",
    lead: "For questions about listings, accounts, or personal data, contact us by email.",
    sections: [{ heading: "Contact", body: "Email ivanovdavid119@gmail.com and include the relevant URL or listing ID when possible." }],
  },
  privacy: {
    title: "Privacy",
    description: "Privacy information for SiteCraft Auto Market.",
    heading: "Privacy",
    lead: "We process only the data required for accounts, listings, and secure operation of the service.",
    sections: [
      { heading: "Data we process", body: "This includes account details, listing data, uploaded images, and technically necessary logs." },
      { heading: "Your rights", body: "You may request access to, correction of, or deletion of your personal data." },
    ],
  },
  impressum: {
    title: "Legal notice",
    description: "Provider information for SiteCraft Auto Market.",
    heading: "Legal notice",
    lead: "Information about the provider of this service.",
    sections: [{ heading: "Contact", body: "SiteCraft Agency · Email: ivanovdavid119@gmail.com" }],
  },
};

const fr: Record<PublicStaticPageCode, PublicStaticPage> = {
  sell: {
    title: "Vendre un véhicule",
    description: "Créez et publiez votre annonce de véhicule sur SiteCraft Auto Market.",
    heading: "Vendez votre véhicule en toute sécurité",
    lead: "Les photos et les données du véhicule sont enregistrées comme brouillon et vérifiées avant publication.",
    sections: [{ heading: "Créer une annonce", body: "Connectez-vous, ajoutez vos photos et vérifiez chaque information avant d’envoyer l’annonce." }],
  },
  pricing: {
    title: "Tarifs",
    description: "Tarifs et services optionnels de SiteCraft Auto Market.",
    heading: "Des services transparents",
    lead: "La création du brouillon et les options de promotion sont clairement expliquées avant toute action payante.",
    sections: [{ heading: "Aucun coût caché", body: "Le prix final est affiché avant la confirmation d’un service payant." }],
  },
  support: {
    title: "Assistance",
    description: "Aide et coordonnées de SiteCraft Auto Market.",
    heading: "Comment pouvons-nous vous aider ?",
    lead: "Pour toute question concernant une annonce, un compte ou vos données, contactez-nous par e-mail.",
    sections: [{ heading: "Contact", body: "Écrivez à ivanovdavid119@gmail.com et indiquez si possible l’URL ou l’identifiant de l’annonce." }],
  },
  privacy: {
    title: "Confidentialité",
    description: "Informations sur la confidentialité de SiteCraft Auto Market.",
    heading: "Confidentialité",
    lead: "Nous traitons uniquement les données nécessaires aux comptes, aux annonces et au fonctionnement sécurisé du service.",
    sections: [
      { heading: "Données traitées", body: "Cela comprend les informations du compte, les données des annonces, les images ajoutées et les journaux techniquement nécessaires." },
      { heading: "Vos droits", body: "Vous pouvez demander l’accès, la rectification ou la suppression de vos données personnelles." },
    ],
  },
  impressum: {
    title: "Mentions légales",
    description: "Informations sur l’éditeur de SiteCraft Auto Market.",
    heading: "Mentions légales",
    lead: "Informations concernant l’éditeur de ce service.",
    sections: [{ heading: "Contact", body: "SiteCraft Agency · E-mail : ivanovdavid119@gmail.com" }],
  },
};

const ru: Record<PublicStaticPageCode, PublicStaticPage> = {
  sell: {
    title: "Продать автомобиль",
    description: "Создайте и опубликуйте объявление автомобиля на SiteCraft Auto Market.",
    heading: "Продайте автомобиль безопасно",
    lead: "Фотографии и данные автомобиля сохраняются как черновик и проверяются перед публикацией.",
    sections: [{ heading: "Создать объявление", body: "Войдите в аккаунт, загрузите фотографии и проверьте все данные перед отправкой объявления." }],
  },
  pricing: {
    title: "Тарифы",
    description: "Тарифы и дополнительные услуги SiteCraft Auto Market.",
    heading: "Прозрачные услуги",
    lead: "Создание черновика и дополнительные варианты продвижения понятно описываются до любого платного действия.",
    sections: [{ heading: "Без скрытых платежей", body: "Итоговая цена показывается до подтверждения платной услуги." }],
  },
  support: {
    title: "Поддержка",
    description: "Помощь и контакты SiteCraft Auto Market.",
    heading: "Чем мы можем помочь?",
    lead: "По вопросам объявлений, аккаунтов или персональных данных свяжитесь с нами по электронной почте.",
    sections: [{ heading: "Контакты", body: "Напишите на ivanovdavid119@gmail.com и по возможности укажите URL или идентификатор объявления." }],
  },
  privacy: {
    title: "Конфиденциальность",
    description: "Информация о конфиденциальности SiteCraft Auto Market.",
    heading: "Конфиденциальность",
    lead: "Мы обрабатываем только данные, необходимые для аккаунтов, объявлений и безопасной работы сервиса.",
    sections: [
      { heading: "Какие данные мы обрабатываем", body: "К ним относятся данные аккаунта и объявления, загруженные изображения и технически необходимые журналы." },
      { heading: "Ваши права", body: "Вы можете запросить доступ, исправление или удаление своих персональных данных." },
    ],
  },
  impressum: {
    title: "Правовая информация",
    description: "Информация о поставщике SiteCraft Auto Market.",
    heading: "Правовая информация",
    lead: "Сведения о поставщике этого сервиса.",
    sections: [{ heading: "Контакты", body: "SiteCraft Agency · Email: ivanovdavid119@gmail.com" }],
  },
};

const uk: Record<PublicStaticPageCode, PublicStaticPage> = {
  sell: {
    title: "Продати автомобіль",
    description: "Створіть і опублікуйте оголошення автомобіля на SiteCraft Auto Market.",
    heading: "Продайте автомобіль безпечно",
    lead: "Фотографії та дані автомобіля зберігаються як чернетка й перевіряються перед публікацією.",
    sections: [{ heading: "Створити оголошення", body: "Увійдіть в обліковий запис, завантажте фотографії та перевірте всі дані перед надсиланням оголошення." }],
  },
  pricing: {
    title: "Тарифи",
    description: "Тарифи та додаткові послуги SiteCraft Auto Market.",
    heading: "Прозорі послуги",
    lead: "Створення чернетки й додаткові варіанти просування зрозуміло описуються до будь-якої платної дії.",
    sections: [{ heading: "Без прихованих платежів", body: "Підсумкова ціна показується до підтвердження платної послуги." }],
  },
  support: {
    title: "Підтримка",
    description: "Допомога та контакти SiteCraft Auto Market.",
    heading: "Чим ми можемо допомогти?",
    lead: "З питань оголошень, облікових записів або персональних даних зв’яжіться з нами електронною поштою.",
    sections: [{ heading: "Контакти", body: "Напишіть на ivanovdavid119@gmail.com і, якщо можливо, вкажіть URL або ідентифікатор оголошення." }],
  },
  privacy: {
    title: "Конфіденційність",
    description: "Інформація про конфіденційність SiteCraft Auto Market.",
    heading: "Конфіденційність",
    lead: "Ми обробляємо лише дані, необхідні для облікових записів, оголошень і безпечної роботи сервісу.",
    sections: [
      { heading: "Які дані ми обробляємо", body: "До них належать дані облікового запису й оголошення, завантажені зображення та технічно необхідні журнали." },
      { heading: "Ваші права", body: "Ви можете запросити доступ, виправлення або видалення своїх персональних даних." },
    ],
  },
  impressum: {
    title: "Правова інформація",
    description: "Інформація про постачальника SiteCraft Auto Market.",
    heading: "Правова інформація",
    lead: "Відомості про постачальника цього сервісу.",
    sections: [{ heading: "Контакти", body: "SiteCraft Agency · Email: ivanovdavid119@gmail.com" }],
  },
};

const tr: Record<PublicStaticPageCode, PublicStaticPage> = {
  sell: {
    title: "Araç sat",
    description: "SiteCraft Auto Market'te araç ilanınızı oluşturun ve yayımlayın.",
    heading: "Aracınızı güvenle satın",
    lead: "Fotoğraflar ve araç bilgileri taslak olarak kaydedilir ve yayımlanmadan önce kontrol edilir.",
    sections: [{ heading: "İlan oluştur", body: "Oturum açın, fotoğraflarınızı yükleyin ve ilanı göndermeden önce tüm bilgileri kontrol edin." }],
  },
  pricing: {
    title: "Fiyatlandırma",
    description: "SiteCraft Auto Market fiyatları ve isteğe bağlı hizmetleri.",
    heading: "Şeffaf hizmetler",
    lead: "Taslak oluşturma ve isteğe bağlı öne çıkarma seçenekleri, ücretli bir işlemden önce açıkça gösterilir.",
    sections: [{ heading: "Gizli ücret yok", body: "Ücretli bir hizmeti onaylamadan önce nihai fiyat gösterilir." }],
  },
  support: {
    title: "Destek",
    description: "SiteCraft Auto Market yardım ve iletişim bilgileri.",
    heading: "Nasıl yardımcı olabiliriz?",
    lead: "İlanlar, hesaplar veya kişisel verilerle ilgili sorularınız için e-posta yoluyla bize ulaşın.",
    sections: [{ heading: "İletişim", body: "ivanovdavid119@gmail.com adresine yazın ve mümkünse ilgili URL'yi veya ilan kimliğini ekleyin." }],
  },
  privacy: {
    title: "Gizlilik",
    description: "SiteCraft Auto Market gizlilik bilgileri.",
    heading: "Gizlilik",
    lead: "Yalnızca hesaplar, ilanlar ve hizmetin güvenli çalışması için gerekli verileri işleriz.",
    sections: [
      { heading: "İşlediğimiz veriler", body: "Bunlar hesap bilgilerini, ilan verilerini, yüklenen görselleri ve teknik olarak gerekli günlükleri içerir." },
      { heading: "Haklarınız", body: "Kişisel verilerinize erişim, düzeltme veya silme talebinde bulunabilirsiniz." },
    ],
  },
  impressum: {
    title: "Yasal bildirim",
    description: "SiteCraft Auto Market hizmet sağlayıcı bilgileri.",
    heading: "Yasal bildirim",
    lead: "Bu hizmetin sağlayıcısı hakkında bilgiler.",
    sections: [{ heading: "İletişim", body: "SiteCraft Agency · E-posta: ivanovdavid119@gmail.com" }],
  },
};

const ar: Record<PublicStaticPageCode, PublicStaticPage> = {
  sell: {
    title: "بيع مركبة",
    description: "أنشئ إعلان مركبتك وانشره على SiteCraft Auto Market.",
    heading: "بِع مركبتك بأمان",
    lead: "تُحفظ الصور وبيانات المركبة كمسودة وتُراجع قبل النشر.",
    sections: [{ heading: "إنشاء إعلان", body: "سجّل الدخول، وارفع صورك، وراجع جميع المعلومات قبل إرسال الإعلان." }],
  },
  pricing: {
    title: "الأسعار",
    description: "الأسعار والخدمات الاختيارية في SiteCraft Auto Market.",
    heading: "خدمات واضحة",
    lead: "يتم توضيح إنشاء المسودة وخيارات الترويج قبل تأكيد أي خدمة مدفوعة.",
    sections: [{ heading: "لا رسوم مخفية", body: "يظهر السعر النهائي قبل تأكيد أي خدمة مدفوعة." }],
  },
  support: {
    title: "الدعم",
    description: "المساعدة ومعلومات التواصل مع SiteCraft Auto Market.",
    heading: "كيف يمكننا مساعدتك؟",
    lead: "للأسئلة المتعلقة بالإعلانات أو الحسابات أو البيانات الشخصية، تواصل معنا عبر البريد الإلكتروني.",
    sections: [{ heading: "التواصل", body: "راسل ivanovdavid119@gmail.com وأرفق رابط الصفحة أو معرّف الإعلان إن أمكن." }],
  },
  privacy: {
    title: "الخصوصية",
    description: "معلومات الخصوصية الخاصة بـ SiteCraft Auto Market.",
    heading: "الخصوصية",
    lead: "نعالج فقط البيانات اللازمة للحسابات والإعلانات والتشغيل الآمن للخدمة.",
    sections: [
      { heading: "البيانات التي نعالجها", body: "تشمل بيانات الحساب والإعلان والصور المرفوعة والسجلات الضرورية تقنياً." },
      { heading: "حقوقك", body: "يمكنك طلب الوصول إلى بياناتك الشخصية أو تصحيحها أو حذفها." },
    ],
  },
  impressum: {
    title: "الإشعار القانوني",
    description: "معلومات مزود خدمة SiteCraft Auto Market.",
    heading: "الإشعار القانوني",
    lead: "معلومات عن مزود هذه الخدمة.",
    sections: [{ heading: "التواصل", body: "SiteCraft Agency · البريد الإلكتروني: ivanovdavid119@gmail.com" }],
  },
};

const euWaveDictionaries = Object.fromEntries(
  EU_WAVE_LOCALES.map((locale) => [locale, translateEuWaveData(en, locale)]),
);

const dictionaries: Partial<Record<string, Record<PublicStaticPageCode, PublicStaticPage>>> = { de, en, fr, tr, ar, ru, uk, ...euWaveDictionaries };

export function hasPublicStaticPageDictionary(locale: string) {
  return Object.hasOwn(dictionaries, locale)
    && PUBLIC_STATIC_PAGE_CODES.every((page) => Boolean(dictionaries[locale]?.[page]));
}

export function isPublicStaticPageCode(value: unknown): value is PublicStaticPageCode {
  return typeof value === "string" && PUBLIC_STATIC_PAGE_CODES.includes(value as PublicStaticPageCode);
}

export function getPublicStaticPage(locale: string, page: PublicStaticPageCode) {
  return dictionaries[locale]?.[page] || null;
}
