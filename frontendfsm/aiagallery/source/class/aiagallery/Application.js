/**
 * Main application class of the App Inventor for Android Gallery
 *
 * Copyright (c) 2011 Derrell Lipman
 * 
 * License:
 *   LGPL: http://www.gnu.org/licenses/lgpl.html 
 *   EPL : http://www.eclipse.org/org/documents/epl-v10.php
 */

/*
#use(aiagallery.module.mgmt.users.Gui)
#use(aiagallery.main.AbstractModule)
*/

/**
 * Main menu
 */
qx.Class.define("aiagallery.Application",
{
  extend : qx.application.Standalone,

  statics :
  {
    /**
     * Set the global cursor to indicate an action is in progress
     *
     * @param b {Boolean}
     *   <i>true</i> to turn on the progress cursor;
     *   <i>false</i> to turn it off
     */
    progressCursor : function(b)
    {
      var             cursor;
      var             root = qx.core.Init.getApplication().getRoot();

      if (b)
      {
        cursor = qx.core.Init.getApplication().PROGRESS_CURSOR;
        root.setGlobalCursor(cursor);
      }
      else
      {
        root.resetGlobalCursor();
      }
    }
  },

  members :
  {
    /**
     * This method contains the initial application code and gets called
     * during startup of the application
     */
    main : function()
    {
      var             menuItem;
      var             moduleName;

      // Call super class
      this.base(arguments);

      // Enable logging in debug variant
      if (qx.core.Variant.isSet("qx.debug", "on"))
      {
        var appender;

        // support native logging capabilities, e.g. Firebug for Firefox
        appender = qx.log.appender.Native;

        // support additional cross-browser console. Press F7 to
        // toggle visibility
        appender = qx.log.appender.Console;
      }

      // Determine the path to our progress cursor
      qx.core.Init.getApplication().PROGRESS_CURSOR = "progress";

      // Use the progress cursor now, until we're fully initialized
      qx.core.Init.getApplication().constructor.progressCursor(true);

      // For each module...
      var moduleList = aiagallery.main.Module.getList();
      for (menuItem in moduleList)
      {
        // ... there can be multiple available items in top-level menu item
        for (moduleName in moduleList[menuItem])
        {
          // ... call the module's buildInitialFsm() function
          var module = moduleList[menuItem][moduleName]["clazz"].getInstance();
          module.buildInitialFsm(moduleList[menuItem][moduleName]);
        }
      }

      // Initialize the gui for the main menu
      var iconList = aiagallery.main.Module.getIconList();
      var functionList = aiagallery.main.Module.getFunctionList();
      aiagallery.main.Gui.getInstance().buildGui(moduleList,
                                                 iconList,
                                                 functionList);

      // Similarly, now that we have a canvas for each module, ...
      for (menuItem in moduleList)
      {
        for (moduleName in moduleList[menuItem])
        {
          // ... call the module's buildInitialGui() function
          var module = moduleList[menuItem][moduleName]["clazz"].getInstance();
          module.buildInitialGui(moduleList[menuItem][moduleName]);
        }
      }
      
      // Start the RPC simulator by instantiating the service methods class
      new aiagallery.rpcsim.RpcSim();
    }
  }
});


/*
 * Register our supported modules.  The order listed here is the order they
 * will appear in the Modules menu. Additionally, for a two-level menu, the
 * first parameter to the aiagallery.main.Module constructor may be the same
 * as a previous one. (
 */

/*
new aiagallery.main.Module(
  "Gallery",
  "aiagallery/test.png",
  "Browse and Search",
  aiagallery.module.gallery.home.Home);

new aiagallery.main.Module(
  "Gallery",
  "aiagallery/test.png",
  "My Applications",
  aiagallery.module.gallery.myapplications.MyApplications);
*/

new aiagallery.main.Module(
  "Users",
  "aiagallery/test.png",
  "Users",
  aiagallery.module.mgmt.users.Users);

new aiagallery.main.Module(
  "Management",
  "aiagallery/test.png",
  "Users",
  aiagallery.module.mgmt.users.Users);

new aiagallery.main.Module(
  "Management",
  null,
  "Application",
  aiagallery.module.mgmt.users.Users);
