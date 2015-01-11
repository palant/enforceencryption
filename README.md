Enforce Encryption
==================

Enforce Encryption is a Firefox extension that extends Page Info dialog to allow managing Strict Transport Security – a built-in Firefox feature that determines whether encrypted connection is enforced for a website. [Detailed description](https://palant.de/2014/03/31/enforce-encryption)

Prerequisites
-------------
* [Python 2.7](https://www.python.org/downloads/)
* [Jinja2 module for Python](http://jinja.pocoo.org/docs/intro/#installation)

How to build
------------

Run the following command:

    python build.py build

This will create a development build with the file name like `enforceencryption-1.2.3.nnnn.xpi`. In order to create a release build use the following command:

    python build.py build --release

How to test
-----------

Testing your changes is easiest if you install the [Extension Auto-Installer extension](https://addons.mozilla.org/addon/autoinstaller/). Then you can push the current repository state to your browser using the following command:

    python build.py autoinstall 8888

Enforce Encryption will be updated automatically, without any prompts or browser restarts.
