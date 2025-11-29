---
title: Portmaster blocking apt on wsl
categories: Tech
date: 2025-11-29T10:57
uploadto:
---
היום נעשה קצת מחקר רשתי על הלפטופ אחרי שמשהו נשבר בקטע מוזר ולא הופיע בשום מקום שמשהו בעייתי.
### אמ;לק
עבדתי על הWSL שלי ופתאום שמתי לב שלעדכן חבילות עם apt הפסיק לעבוד. במקרה יש לי firewall על הhost הווינדוזי, קוראים לו Portmaster והוא די טוב. מה הסיכוי שזה קשור? 100%. השאלה היא למה זה נחסם, וזה מה שנחקור היום.

### זיהוי ראשוני
הפקודה תמיד נעצרה בשלב של `[Connecting to archive.ubuntu.com]` אז הנחתי שמדובר בעניין רשתי או סרטיפיקט. Portmaster היה אחד הדברים הראשונים שהסתכלתי עליהם, אבל ברשימת הblocked connections לא הופיע שום דבר שנראה קשור לapt או wsl, לא מבחינת IPים או פורטים ולא מבחינת פרוססים. כבר מעניין. ליתר ביטחון ווידאתי apt hosts ובדקתי שהמכונה מתקשרת כמו שצריך החוצה.

ערכתי את הניסוי הבא:
- הרצתי `sudo apt update` וראיתי שנתקע בשלב `[Connecting to archive.ubuntu.com]`
- עצרתי את הservice של Portmaster
- הרצתי `sudo apt update` והכל עבד
- הרצתי את הservice של Portmaster
- ניסיתי שוב ונכשל

ישר הרצתי `ip a` על הWSL כדי לראות את הIP הפנימי של המכונה, ופתחתי wireshark על הרגל הוירטואלית של הhyperv על הhost וtcpdump על הguest. הייתה שם תעבורה שנדמה שהייתה דו"צ באמת לשרת שמזוהה עם apt.
### סוף דבר
אחרי שנהניתי קצת, חיפשתי `portmaster wsl` בduckduckgo ועלה [הפוסט הבא בreddit](https://www.reddit.com/r/safing/comments/ryioj7/portmaster_breaks_wsl2_in_windows_11_a_guide_to/) יופי זה מסביר מלא דברים.