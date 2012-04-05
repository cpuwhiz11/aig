/**
 * Copyright (c) 2011 Derrell Lipman
 * 
 * License:
 *   LGPL: http://www.gnu.org/licenses/lgpl.html 
 *   EPL : http://www.eclipse.org/org/documents/epl-v10.php
 */

qx.Class.define("aiagallery.dbif.DbifAppEngine",
{
  extend  : liberated.appengine.Dbif,
  type    : "singleton",

  include : 
  [
    aiagallery.dbif.MDbifCommon
  ],
  
  construct : function()
  {
    // Call the superclass constructor
    this.base(arguments);
    
    // Prepare for remote procedure calls to aiagallery.features.*
    this.__rpc = 
      new liberated.appengine.Rpc([ "aiagallery", "features" ], "/rpc");
  },
  
  members :
  {
    /**
     * Register a service name and function.
     *
     * @param serviceName {String}
     *   The name of this service within the <[rpcKey]> namespace.
     *
     * @param fService {Function}
     *   The function which implements the given service name.
     * 
     * @param paramNames {Array}
     *   The names of the formal parameters, in order.
     */
    registerService : function(serviceName, fService, paramNames)
    {
      // Register with the RPC provider
      this.__rpc.registerService(serviceName, fService, this, paramNames);
    },

    /**
     * Process an incoming request which is presumably a JSON-RPC request.
     * 
     * @param jsonData {String}
     *   The data provide in a POST request
     * 
     * @return {String}
     *   Upon success, the JSON-encoded result of the RPC request is returned.
     *   Otherwise, null is returned.
     */
    processRequest : function(jsonData)
    {
      return this.__rpc.processRequest(jsonData);
    },

    /**
     * Identify the current user. Register him in the whoAmI property.
     */
    identify : function()
    {
      var             UserServiceFactory;
      var             userService;
      var             user;
      var             email;
      var             displayName;
      var             visitor;
      var             googleUserId;
      var             googleNickname;
      var             permissions;

      // Find out who is logged in
      UserServiceFactory =
        Packages.com.google.appengine.api.users.UserServiceFactory;
      userService = UserServiceFactory.getUserService();
      user = userService.getCurrentUser();
      
      // If no one is logged in...
      if (! user)
      {
        this.setWhoAmI(
          {
            id                : "",
            email             : "anonymous",
            displayName       : "",
            isAdmin           : false,
            logoutUrl         : "",
            permissions       : [],
            hasSetDisplayName : true
          });
        return;
      }

      email = String(user.getEmail());
      googleNickname = String(user.getNickname());
      googleUserId = String(user.getUserId());

      // Try to get this user's display name. Does the visitor exist?
      visitor = liberated.dbif.Entity.query("aiagallery.dbif.ObjVisitors", 
                                            googleUserId);
      // Encapsulate in transaction to avoid race condition  
      liberated.dbif.Entity.asTransaction(
        function(){                                    
          if (visitor.length > 0)
          {
            // Yup, he exists.
            displayName = visitor[0].displayName || this.__randNameGen();
            permissions = 
              aiagallery.dbif.MVisitors.getVisitorPermissions(visitor[0]);
          }
          else
          {
            // He doesn't exist. Create an unique random name
            displayName = this.__randNameGen();
            permissions = [];
          }  
        }, [], this); 
        
        // Save the logged-in user. The whoAmI property is in MDbifCommon.
        this.setWhoAmI(
          {
            id                : googleUserId,
            email             : email,
            displayName       : displayName,
            isAdmin           : userService.isUserAdmin(),
            logoutUrl         : userService.createLogoutURL("/"),
            permissions       : permissions,
            hasSetDisplayName : displayName != googleUserId
          });
    },
         
    /*
     * Create a randomly generated name.
     * First character must be a lowercase letter, 
     * next five characters must be either a letter or number.
     * 
     * After generating a random name, check to ensure name is unique.
     * 
     * @return {String}
     *  Randomly generated unique name 
     */ 

    __randNameGen : function()
    {   
      var              resultList;
      var              newName; 
      var              criteria;
      var              i; 

      // Keep generating names until an unique one is found
      do 
      {
        newName = "";
        var letters = "abcdefghijklmnopqrstuvwxyz";
        var lettersNums = "abcdefghijklmnopqrstuvwxyz0123456789";

        // First char must be a letter
        newName += letters.charAt(Math.floor(Math.random() * letters.length));

        //Next five characters can be letters or numbers
        for(i = 0; i < 5; i++ ) 
        {
          newName +=
            lettersNums.charAt(Math.floor(Math.random() * lettersNums.length));
        }      
        
        criteria = 
          {
            type : "element",
            field : "displayName",
            value : newName
          }; 
        
        // Check to ensure name is unique
        resultList = 
          liberated.dbif.Entity.query("aiagallery.dbif.ObjVisitors", 
                                      criteria);

      } while(resultList.length != 0) 

      return newName;  
    }
  },

  defer : function()
  {
    // Register our put, query, and remove functions
    liberated.dbif.Entity.registerDatabaseProvider(
      liberated.appengine.Dbif.query,
      liberated.appengine.Dbif.put,
      liberated.appengine.Dbif.remove,
      liberated.appengine.Dbif.getBlob,
      liberated.appengine.Dbif.putBlob,
      liberated.appengine.Dbif.removeBlob,
      liberated.appengine.Dbif.beginTransaction,
      { 
        dbif        : "appengine",
        initRootKey : liberated.appengine.Dbif.initRootKey
      });
  }
});
