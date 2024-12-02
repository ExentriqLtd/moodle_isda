Moodle App
=================

This is the primary repository of source code for the official mobile app for Moodle.

* [User documentation](https://docs.moodle.org/en/Moodle_app)
* [Developer documentation](https://moodledev.io/general/app)
* [Development environment setup](https://moodledev.io/general/app/development/setup)
* [Bug Tracker](https://tracker.moodle.org/browse/MOBILE)
* [Release Notes](https://moodledev.io/general/app_releases)

This project is tested with BrowserStack.

License
-------

[Apache 2.0](http://www.apache.org/licenses/LICENSE-2.0)


## MAC OS - Lauch Chrome
open -na Google\ Chrome --args --user-data-dir=/tmp/temporary-chrome-profile-dir --disable-web-security

##Download initial language pack
./update_lang.sh


## Troubleshooting
1. To build `Android` APP you need to move two files: `google-services.json` -> `platforms/android/app` and `resources/android/xml/network_security_config.xml` -> `platforms/android/app/src/res/xml`