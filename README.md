Enforce Encryption (DEPRECATED!)
==================

IMPORTANT: This extension is deprecated. The latest tagged version will not work in Firefox 57 and above, whereas latest commit hasn't been sufficiently tested. This functionality isn't really necessary today given that the most important websites use Strict Transport Security out of the box.

Enforce Encryption is a Firefox, Chrome, Opera and Edge extension that allows managing Strict Transport Security. This is a built-in browser feature that that enforces encrypted connections for websites, normally activated by the website itself. With Enforce Encryption you can activate Strict Transport Security for any website by clicking the Enforce Encryption icon (only available for encrypted connections). [Detailed description](https://palant.de/2014/03/31/enforce-encryption)

Installing build prerequisites
------------------------------

In order to build Enforce Encryption you will need to install [Node.js](https://nodejs.org/) first (Node 6 or higher is required). You will also need [Gulp](http://gulpjs.com/), run the following command to install it (administrator privileges required):

    npm install --global gulp-cli

Additional dependencies are installed using the following command in the extension directory:

    npm install

How to build
------------

If all the dependencies are installed, creating a Firefox build is simply a matter of running Gulp:

    gulp xpi

This will produce a file named like `enforceencryption-n.n.n.xpi`. Creating a build for Chrome and Opera is similar but requires a private key that the build should be signed with:

    gulp crx --private-key=key.pem

This will create a signed Chrome packaged named like `enforceencryption-n.n.n.crx`. If you omit the private key parameter you will get an unsigned ZIP package instead.

How to test
-----------

In order to test your changes you can load the repository to your browser as an unpacked extension directly. Then you will only have to reload in order for the changes to apply.
