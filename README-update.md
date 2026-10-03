# آپدیت کاتالوگ ZINK Screen 🎬

## چی اضافه شد؟
۳۲ عنوان جدید به `movies.json` اضافه شد (مجموع: ۳۹ عنوان):

- **فیلم (۱۳ عنوان جدید):** Interstellar, Inception, The Dark Knight, Dune: Part Two, Oppenheimer, Joker, Parasite, Gladiator, Mad Max: Fury Road, Whiplash, The Godfather, Fight Club, Blade Runner 2049
- **سریال (۱۱ عنوان جدید):** Game of Thrones, The Last of Us, Dark, Sherlock, Stranger Things, Chernobyl, Prison Break, Squid Game, Better Call Saul, True Detective, The Boys
- **کنسرت و موزیک‌فیلم (۸ عنوان جدید):** Queen – Live Aid 1985, Pink Floyd – Live at Pompeii, Coldplay – Music Of The Spheres, Taylor Swift – The Eras Tour, Michael Jackson – This Is It, Bohemian Rhapsody, Rocketman, Metallica – S&M2

هیچ‌کدام از عنوان‌های قبلی تغییر نکرده‌اند.

## تصویرها
برای هر عنوان یک **پوستر** و یک **بنر** اختصاصی به‌صورت SVG ساخته شده، هم‌رنگ با تم سایت (مشکی + قرمز زرشکی + طلایی):

```
images/generated/<id>.svg              ← پوستر و کارت
images/generated/banners/<id>-banner.svg ← بنر صفحه پخش / هیرو
```

این‌ها وزن خیلی کمی دارند و در هر رزولوشنی تیز می‌مانند.

## اگر خواستی پوستر واقعی بگذاری
کافیه فایل تصویر واقعی را در پوشه `images/` بگذاری و در `movies.json` سه فیلد را عوض کنی:

```json
"poster": "./images/interstellar.jpg",
"card":   "./images/interstellar.jpg",
"banner": "./images/hero-banners/interstellar-banner.jpg"
```

## نصب
فایل `movies.json` و پوشه‌ی `images/generated/` را داخل پروژه‌ی اصلی‌ات کپی کن (بقیه‌ی فایل‌ها دست‌نخورده‌اند).
