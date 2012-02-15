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
#require(aiagallery.dbif.DbifSim)
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
     * Internal storage of the dateFormat object used by {@link getDateFormat} 
     */
    __dateFormatObj : null,

    /** The application-wide format for displaying dates */
    __dateFormat : "yyyy-MM-dd hh:mm a",

    /**
     * Get the application-wide DateFormat object. The actual format used is
     * stored in {@link __dateFormat}.
     * 
     * @return {qx.util.format.DateFormat}
     *   The object whose format() object may be passed a date object to be
     *   converted to our application-wide format.
     */
    getDateFormat : function()
    {
      var             dateFormat;
      
      // Retrieve the pre-allocated date format, or allocate a new one
      dateFormat =
        aiagallery.Application.__dateFormatObj ||
        new qx.util.format.DateFormat(aiagallery.Application.__dateFormat);
      
      // Save the date format object, in case it wasn't previously saved
      aiagallery.Application.__dateFormatObj = dateFormat;
      
      return dateFormat;
    },

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
    },
    
    addModules : function(moduleList)
    {
      var             menuItem;
      var             moduleName;
      var             module;
      var             iconList;
      var             functionList;
      
      // For each module...
      for (menuItem in moduleList)
      {
        // ... there can be multiple available items in top-level menu item
        for (moduleName in moduleList[menuItem])
        {
          // ... call the module's buildInitialFsm() function
          if (moduleList[menuItem][moduleName].bNewInstance)
          {
            // We must instantiate a new instance of this module
            module = new moduleList[menuItem][moduleName]["clazz"]();
          }
          else
          {
            // The module is a singleton, so get its one and only instance
            module = moduleList[menuItem][moduleName]["clazz"].getInstance();
          }
          module.buildInitialFsm(moduleList[menuItem][moduleName]);
        }
      }

      // Initialize the gui for the main menu
      iconList = aiagallery.main.Module.getIconList();
      functionList = aiagallery.main.Module.getFunctionList();
      aiagallery.main.Gui.getInstance().buildGui(moduleList,
                                                 iconList,
                                                 functionList);

      // Similarly, now that we have a canvas for each module, ...
      for (menuItem in moduleList)
      {
        for (moduleName in moduleList[menuItem])
        {
          // ... call the module's buildInitialGui() function
          if (moduleList[menuItem][moduleName].bNewInstance)
          {
            // Type is "new" so create a new instance of this module
            module = new moduleList[menuItem][moduleName]["clazz"]();
          }
          else
          {
            // Type is "singleton""
            module = moduleList[menuItem][moduleName]["clazz"].getInstance();
          }
          module.buildInitialGui(moduleList[menuItem][moduleName]);
        }
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
      if (qx.core.Environment.get("qx.debug"))
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

      // Start the RPC simulator by getting its singleton instance
      this.dbif = aiagallery.dbif.DbifSim.getInstance();

      // Get the module list
      var moduleList = aiagallery.main.Module.getList();

      // Add the modules in the module list
      aiagallery.Application.addModules(moduleList);
      
      // Back button and bookmark support
      this.__initBookmarkSupport(moduleList);
    },
     /**
     * Back button and bookmark support
     * Include moduleList to check against it
     */
    __initBookmarkSupport : function(moduleList)
    {
      this.__history = qx.bom.History.getInstance();
      this.__history.addListener("request", this.__onHistoryChanged, this);

      // Handle bookmarks
      var state = this.__history.getState();
      var name = state.replace(/_/g, " ");

      var code = "";

      // checks if the state corresponds to a main tab. If yes, the application
      // will be initialized with the selected main tab
      if (false)
      {
        this.__selectModule(moduleName);
        return;
        
      // if no state is given default to home page
      } else {
        this.__selectModule("Find Apps"); 
        return;
      }
    },


    /**
     * Handler for changes of the history.
     * @param e {qx.event.type.Data} Data event containing the history changes.
     */
    __onHistoryChanged : function(e)
    {
      var state = e.getData();

      // is a sample name given
      if (this.__samples.isAvailable(state))
      {
        var sample = this.__samples.get(state);
        if (this.__isCodeNotEqual(sample.getCode(), this.__editor.getCode())) {
          this.setCurrentSample(sample);
        }

      // is code given
      } else if (state != "") {
        var code = this.__parseURLCode(state);
        if (code != this.__editor.getCode()) {
          this.__editor.setCode(code);
          this.setName(this.tr("Custom Code"));
          this.run();
        }
      }
    },


    /**
     * Helper method for parsing the given url parameter to a valid code
     * fragment.
     * @param state {String} The given state of the browsers history.
     * @return {String} A valid code snippet.
     */
    __parseURLCode : function(state)
    {
      try {
        var data = qx.lang.Json.parse(state);
        // change the mode in case a different mode is given
        if (data.mode && data.mode != this.__mode) {
          this.setMode(data.mode);
        }
        return decodeURIComponent(data.code).replace(/%0D/g, "");
      } catch (e) {
        var error = this.tr("// Could not handle URL parameter! \n// %1", e);

        if (qx.core.Environment.get("engine.name") == "mshtml") {
          error += this.tr("// Your browser has a length restriction of the " +
                          "URL parameter which could have caused the problem.");
        }
        return error;
      }
    },


    /**
     * Adds the given code to the history.
     * @param code {String} the code to add.
     * @lint ignoreDeprecated(confirm)
     */
    __addCodeToHistory : function(code) {
      var codeJson =
        '{"code":' + '"' + encodeURIComponent(code) + '", "mode":"' + this.__mode + '"}';
      if (qx.core.Environment.get("engine.name") == "mshtml" && codeJson.length > 1300) {
        if (!this.__ignoreSaveFaults && confirm(
          this.tr("Cannot append sample code to URL, as it is too long. " +
                  "Disable this warning in the future?"))
        ) {
          this.__ignoreSaveFaults = true;
        };
        return;
      }
      this.__history.addToHistory(codeJson);
    },
    
    /**
    * Select, in the main view, the module contained in the String moduleName
    */
    __selectModule : function(moduleName)
    {
      var mainTabs = qx.core.Init.getApplication().getUserData("mainTabs");  
      var tabArray;
      
      // If moduleName is "Home" set that immediately and return
      if (moduleName == "Home")
      {
        //mainTabs.setSelection("Home");
        //return;   
      }
      
      // Else get the children
      tabArray = mainTabs.getChildren();
      
      // Iterate through their labels to find the tab
      for (var i in tabArray)
      {
        if(tabArray[i].getLabel() == moduleName)
        {
          // Select Module
          mainTabs.setSelection([tabArray[i]]);  
          
          // Get the page hierarchy
          var hierarchy = 
            aiagallery.main.Gui.getInstance().getUserData("hierarchy");
          
          // Reinitialize the hierarchy to show only this page
          hierarchy.setHierarchy([tabArray[i].getLabel()]);

          // Get the page selector bar
          var pageSelectorBar =
            aiagallery.main.Gui.getInstance().getUserData("pageSelectorBar");

          // Get children
          pageArray = pageSelectorBar.getChildren();
          
          for (var j in pageArray)
          {
            if (pageArray[i].getLabel() == moduleName)
            {
              // Select the page
              pageSelectorBar.setSelection([pageArray[i]]);
            }
          }
     
          return;           
        }
      }
      
      // Never found module name select homepage.  
      //mainTabs.setSelection("Home");
      
      return; 
      
    }

  }
});


/*
 * Register our supported modules.  The order listed here is the order they
 * will appear in the Modules menu. Additionally, for a two-level menu, the
 * first parameter to the aiagallery.main.Module constructor may be the same
 * as a previous one.
 */

/*  The main Gallery */
new aiagallery.main.Module(
  "Home",
  "aiagallery/module/go-home.png",
  "Home",
  aiagallery.module.dgallery.home.Home);

new aiagallery.main.Module(
  "Find Apps",
  "aiagallery/module/system-search.png",
  "Find Apps",
  aiagallery.module.dgallery.findapps.FindApps);

new aiagallery.main.Module(
  "My Apps",
  "aiagallery/module/emblem-favorite.png",
  "My Apps",
  aiagallery.module.dgallery.myapps.MyApps);



if (qx.core.Environment.get("qx.debug"))
{
  new aiagallery.main.Module(
    "Testing",
    null,
    "Temporary",
    aiagallery.module.testing.temp.Temp);

  new aiagallery.main.Module(
    "Testing",
    "aiagallery/test.png",
    "Mobile",
    aiagallery.module.testing.mobile.Mobile);
}
