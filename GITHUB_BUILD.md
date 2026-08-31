# بناء AI SHARAF APK عبر GitHub Actions

المشروع يحتوي على workflow جاهز في `.github/workflows/android.yml`.

من تبويب Actions اختر `Build AI SHARAF APK` ثم `Run workflow`.

عند نجاح البناء سيظهر Artifact باسم `AI-SHARAF-debug-apk` وبداخله `app-debug.apk`.

يستخدم البناء JDK 17 وGradle 8.9 وAndroid SDK 35 وAndroid Gradle Plugin 8.7.3 وKotlin 2.0.21 مع Compose Compiler plugin المتوافق.
