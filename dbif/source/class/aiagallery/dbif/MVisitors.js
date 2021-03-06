/**
 * Copyright (c) 2011 Derrell Lipman
 * 
 * License:
 *   LGPL: http://www.gnu.org/licenses/lgpl.html 
 *   EPL : http://www.eclipse.org/org/documents/epl-v10.php
 */

/*
#ignore(com.google.*)
 */

qx.Mixin.define("aiagallery.dbif.MVisitors",
{
  construct : function()
  {
    this.registerService("aiagallery.features.addOrEditVisitor",
                         this.addOrEditVisitor,
                         [ "id", "attributes" ]);

    this.registerService("aiagallery.features.whitelistVisitors",
                         this.whitelistVisitors,
                         [ "id", "bAllowAccess" ]);

    this.registerService("aiagallery.features.deleteVisitor",
                         this.deleteVisitor,
                         [ "id" ]);

    this.registerService("aiagallery.features.deleteVisitorWithUsername",
                         this.deleteVisitorWithUsername,
                         [ "username" ]);

    this.registerService("aiagallery.features.editProfile",
                         this.editProfile,
                         [ "profileParams" ]);

    this.registerService("aiagallery.features.getVisitorListAndPGroups",
                         this.getVisitorListAndPGroups,
                         [ "bStringize" ]);

    this.registerService("aiagallery.features.managementAllNotifications",
                         this.managementAllNotifications,
                         [ "bNotifications" ]);
  },
  
  statics :
  {
    getVisitorPermissions : function(visitorData)
    {
      var             pGroups;
      var             permissions = visitorData.permissions || [];
      var             permMap = {};
      
      // Add each permission to a map, so we can detect duplicates later
      permissions.forEach(
        function(perm)
        {
          permMap[perm] = true;
        });
      
      // Get the permission groups that this visitor is a member of
      pGroups = visitorData.permissionGroups || [];
      pGroups.forEach(
        function(pGroup)
        {
          var             thisGroupPermissions;
          
          thisGroupPermissions = liberated.dbif.Entity.query(
            "aiagallery.dbif.ObjPermissionGroup",
            pGroup);
          
          thisGroupPermissions.forEach(
            function(thisGroupPermission)
            {
              thisGroupPermission.permissions.forEach(
                function(perm)
                {
                  permMap[perm] = true;
                });
            });
        });
      
      return qx.lang.Object.getKeys(permMap);
    },

    /**
     * Exchange id for user's displayName
     * 
     *@param id {String}
     * Visitor's id
     * 
     *@return {String}
     * Visitor's display name 
     */
    _getDisplayName : function(id, error)
    {
      
      var visitor = new aiagallery.dbif.ObjVisitors(id);
     
      if (qx.core.Environment.get("qx.debug"))
      {
        // Ensure that an error object is passed
        qx.core.Assert.assertInstance(error,
                                      liberated.rpc.error.Error,
                                      "Need error object");
      }

      // Was our id faulty in some way?
      if (typeof visitor === "undefined" || 
          visitor === null ||
          visitor.getBrandNew())
      {
        // FIXME:
        if (false)
        {
          // Yes, report the error
          error.setCode(1);
          error.setMessage("Unrecognized user ID in MVisitors");
          return error;
        }
        else
        {
          return "<>";
        }
      }
      
      // No problems, give them the display name
      return visitor.getData().displayName;
    }
    
    /**
     * Exchange user's displayName for id
     * 
     *@param displayName {String}
     * Visitor's display name
     * 
     *@return {String} 
     * Visitor's id
     */
/*
    _getVisitorId : function(displayName, error)
    {
      
      var owners = liberated.dbif.Entity.query(
        "aiagallery.dbif.ObjVisitors",
        {
          type  : "element",
          field : "displayName",
          value : displayName
          
        },
        // No resultCriteria. Only need a single result
        null);
      
      // Was there a problem with the query?
      if (typeof owners[0] === "undefined" || owners[0] === null)
      {
        // Yes, report the error
        error.setCode(2);
        error.setMessage("Unrecognized display name: " + displayName);
        return error;
      }
      
      // No problems, give them the ID
      return owners[0].id;
    }
*/
  },
  
  members :
  {
    addOrEditVisitor : function(id, attributes)
    {
      var             email;
      var             displayName;
      var             permissions;
      var             permissionGroups;
      var             status;
      var             statusIndex;
      var             visitor;
      var             visitorData;
      var             ret;
      
      email = attributes.email;
      displayName = attributes.displayName;
      permissions = attributes.permissions;
      permissionGroups = attributes.permissionGroups; 
      status = attributes.status;
      
      // Get the old visitor entry
      visitor = new aiagallery.dbif.ObjVisitors(id);
      visitorData = visitor.getData();
      
      // Provide the new data
      visitorData.id = id;
      visitorData.email = email;
      visitorData.displayName = displayName || visitorData.displayName || "<>";
      visitorData.permissions = permissions || visitorData.permissions || [];
      visitorData.permissionGroups = 
        permissionGroups || visitorData.permissionGroups || [];
      // If the returned status is legit...
      if ( typeof status == "number" && 
           status >= 0 &&
           status < aiagallery.dbif.Constants.StatusToName.length )
      {
        // ... copy it over
        visitorData.status = status;
      }
      // ...otherwise, if the old status is not OK...
      else if ( typeof visitorData.status != "number" )
      {
        // ... just make it "Active"
        visitorData.status = aiagallery.dbif.Constants.Status["Active"];
      }
        // (if old status OK, leave it as is)

      // Write the new data
      visitor.put();

      return visitor.getData();
    },
    
    /**
     * Add or remove a list of visitors, identified by their email addresses,
     * from the whitelist.
     *
     * @param emailAddresses {Array}
     *   List of the email addresses of visitors whose whitelist access should
     *   be altered.
     *
     * @param bAllowAccess {Boolean}
     *   Whether all of the visitors should have whitelist access enabled (or
     *   removed).
     *
     * @return {Map}
     *   The key fields in the map are the email addresses specified in
     *   emailAddresses. The values are booleans indicating whether the email
     *   address was found and updated.
     */
    whitelistVisitors : function(emailAddresses, bAllowAccess, error)
    {
      var             visitor;
      var             visitorData;
      var             pGroups;
      var             ret =
        {
          successes : [],
          failures  : []
        };

      emailAddresses.forEach(
        function(email)
        {
          liberated.dbif.Entity.asTransaction(
            function()
            {
              // Find this visitor by his email address
              visitorData = liberated.dbif.Entity.query(
                "aiagallery.dbif.ObjVisitors",
                {
                  type : "element",
                  field : "email",
                  value : email
                });

              // Ensure that we found this visitor
              if (visitorData.length != 1)
              {
                // Indicate that we failed to update this visitor
                ret.failures.push(email);
                return;
              }

              // Retrieve this visitor object
              visitor = new aiagallery.dbif.ObjVisitors(visitorData[0].id);
              
              // Since the query returned him, he better not be brand new!
              if (visitor.getBrandNew())
              {
                // Indicate that we failed to update this visitor
                ret.failures.push(email);
                return;
              }

              // Retrieve this visitor data, and specifically, the permission
              // groups array.
              visitorData = visitor.getData();
              pGroups = visitorData.permissionGroups || [];

              // First remove "Whitelist" from the list of permission groups.
              // (It may or may not actually be there.)
              qx.lang.Array.remove(pGroups,
                                   aiagallery.dbif.Constants.WHITELIST);

              // Now, if we're told to allow access, ...
              if (bAllowAccess)
              {
                // ... then add it in
                pGroups.push(aiagallery.dbif.Constants.WHITELIST);
              }

              // Replace the old list of permission groups
              visitorData.permissionGroups = pGroups;

              // Save the visitor
              visitor.put();
              
              // Indicate that we successfully updated this visitor
              ret.successes.push(email);
            });
        });
      
      // Give 'em the map of success/failure indications
      return ret;
    },

    /**
     * Delete a visitor with only their string username.
     * Since the frontend is not allowed to have a google id,
     * the username string must be used.
     * 
     * @param username {String}
     *   The string username
     * 
     * @return {String}
     *   The string username of the visitor we just deleted
     * 
     * Can return an error if a name is not found
     */
     deleteVisitorWithUsername : function(username, error)
     {
       var     id;
       var     criteria;
 
       // Find the user's id
       criteria = 
       {
         type  : "element",
         field : "displayName",
         value : username
       }; 
        
       // Check to ensure name is unique
       var resultList = 
         liberated.dbif.Entity.query("aiagallery.dbif.ObjVisitors", 
                                     criteria);                             
  
       // Should return one and only one username     
       if (resultList.length != 1) 
       {
         error.setCode(2);
         error.setMessage("The display name you are "
                          + "trying to clear of flag: \"" 
                          + username
                          + "\" cannot be found."); 
 
         return error;
       } else {
         id = resultList[0].id;
       }
  
       // Delete visitor
       if (this.deleteVisitor(id))
       {
         // User succesfully deleted, remove flags
         this.clearProfileFlagsWithId(id); 
         return username; 
       } else {
         return null; 
       } 
     },

    /**
     * Delete a visitor based on their id number.
     * 
     * @param id {Integer}
     *   The user id number
     * 
     * @return {Boolean}
     *   True if succesful, false otherwise
     */
    deleteVisitor : function(id)
    {
      var             visitor;
      var             criteria;
      var             deleteList; 

      // Retrieve this visitor
      visitor = new aiagallery.dbif.ObjVisitors(id);

      // See if this visitor exists.
      if (visitor.getBrandNew())
      {
        // He doesn't. Let 'em know.
        return false;
      }

      // Remove objects associated with a visitor 
      // All delete calls take place within a transaction
      // Remove all apps authored by a visitor
      criteria =
        {
          type  : "element",
          field : "owner",
          value : id 
        }; 

      // Get all the apps a user has authored
      deleteList = liberated.dbif.Entity.query("aiagallery.dbif.ObjAppData",
                                               criteria,
                                               null);

      // Delete all those apps 
      deleteList.forEach(
        function(app)
        {
          this.mgmtDeleteApp(app.uid);
        }, this);


      // Remove all comments authored by a visitor
      criteria =
        {
          type  : "element",
          field : "visitor",
          value : id 
        }; 

      // Get all the comments a user has authored
      deleteList = liberated.dbif.Entity.query("aiagallery.dbif.ObjComments",
                                               criteria,
                                               null);

      // Delete all those apps 
      deleteList.forEach(
        function(comment)
        {
          this.deleteComment(comment.app, comment.treeId);
        }, this);
      
      // Delete the visitor
      visitor.removeSelf();

      // We were successful
      return true;
    },
    
    editProfile : function(profileParams, error)
    {
      var             me;
      var             meData;
      var             whoami;
      var             propertyTypes;
      var             fields;
      var             bValid = true;
      var             validFields = 
        [
          "displayName",
          "organization",
          "email",
          "birthMonth",
          "birthYear",
          "location",
          "bio",
          "url",
          "showEmail",
          "updateOnAppComment",
          "updateCommentFrequency",
          "updateOnAppLike",
          "updateOnAppLikeFrequency",
          "updateOnAppDownload",
          "updateOnAppDownloadFrequency"
        ];
      
      // Find out who we are
      whoami = this.getWhoAmI();

      // Retrieve the current user's visitor object
      me = new aiagallery.dbif.ObjVisitors(whoami.id);
      
      // Get my object data
      meData = me.getData();

      // Get the field names for this entity type
      propertyTypes = liberated.dbif.Entity.propertyTypes;
      fields = propertyTypes["visitors"].fields;
      
      // For now the actual editing has been encased in a
      // transaction in order to ensure a username change does not
      // inadvertenly take an already in-use name 
      //
      // NOTE: If many more fields are added to validFields, or if any of them
      // require extensive processing, this single transaction may be too time
      // consuming.
      return liberated.dbif.Entity.asTransaction(
        function() 
        {                                               
          // For each of the valid field names...
          try
          {
            validFields.forEach(
              function(fieldName)
              {
                // Is this field being modified?
                if (typeof profileParams[fieldName] == "undefined")
                {
                  // Nope. Nothing to do with this one. Return success
                  return true;
                }

                // Handle displayName specially
                if (fieldName == "displayName") 
                {
                  // Make sure name is clear of whitespace
                  profileParams.displayName = profileParams.displayName.trim();

                  // Ensure new display name is valid. This will throw an
                  // error upon finding an existing display name.
                  this.__checkName(whoami.id, profileParams.displayName, error);

                  // Store back into me
                  meData[fieldName] = profileParams.displayName; 

                  // Update the cache with the new name
                  // Only do this if the name actually changes
                  // In some cases a user can specify a change to the same name
                  if (whoami.displayName != profileParams.displayName) 
                  {
                    this.__updateNameInCache(whoami.displayName, 
                                             profileParams.displayName);   
                  }
                  
                  return true;
                }
            
                // Ensure that the value being set is correct for the field
                switch(typeof profileParams[fieldName])
                {
                  case "string":
                    bValid = (fields[fieldName] == "String");
                    break;

                  case "number":
                    bValid = (fields[fieldName] == "Integer" || 
                              fields[fieldName] == "Float");
                    break;

                  default:
                    bValid = false;
                    break;
                }

                // Is the new profile parameter of the correct type?
                if (! bValid)
                {
                  // Nope. Error ends up in returnVal
                  error.setCode(1);
                  error.setMessage("Unexpected parameter type. " +
                                   "Expected " + fields[fieldName] +
                               ", got " + typeof profileParams[fieldName]);
                  throw error;
                }

                // Assign the new value.
                meData[fieldName] = profileParams[fieldName];
              }, this);
          }
          catch(error)
          {
            // Return, rather than throw, the error, to be returned to the user.
            return error;
          }
      
          // Save the altered profile data
          me.put();

          // success
          return true;
        }, [], this); // End of transaction
    },

    /**
     * Get all the permission groups and visitors
     *
     * @return {Array || Error}
     *   This a map permission groups and visitors, or an error if
     *   something went wrong
     *
     */
    getVisitorListAndPGroups : function(bStringize)
    {
      var             visitor;
      var             visitorList;
      
      // For each visitor...
      visitorList = liberated.dbif.Entity.query("aiagallery.dbif.ObjVisitors");

      // If we were asked to stringize the values...
      if (bStringize)
      {
        // ... then do so
        for (visitor in visitorList)
        {
          var thisGuy = visitorList[visitor];
          thisGuy.permissions = 
            thisGuy.permissions ? thisGuy.permissions.join(", ") : "";
          thisGuy.permissionGroups = 
            thisGuy.permissionGroups ? thisGuy.permissionGroups.join(", ") : "";
          thisGuy.status =
            aiagallery.dbif.Constants.StatusToName[thisGuy.status];
        }
      }    

      // Get the current list of permission groups
      var pGroupList = this.getPermissionGroups(); 
      
      // Construct a map
      var map = 
      {
        "visitors" : visitorList,
        "pGroups"  : pGroupList
      }; 
      
      // We've built the whole list. Return it.
      return map;
    },

    /**
     * Special on off management function to take the
     * value given by the boolean parameter and convert all
     * user's notification settings to it.
     * 
     * @param bNotifications {Boolean}
     *   The value to convert all users notification settings to
     * 
     * @param error {Error}
     *   The error object
     */
    managementAllNotifications : function(bNotifications, error)
    {

      var      visitorList;
      var      intValue;

      // The notifications settings use ints (1 for true, 0 for false)
      // since the db does not support boolean values.
      // Convert the boolean value we got in the parameter to either a 
      // 1 or a 0
      if(bNotifications)
      {
        intValue = 1;
      } 
      else 
      {
        intValue = 0; 
      }

      // Get every user id in the db
      visitorList = liberated.dbif.Entity.query("aiagallery.dbif.ObjVisitors");
      
      // Take each visitor, get their db entry and update 
      // the notification settings
      visitorList.forEach(
        function(visitor)
        {
          var   dbEntry;
          var   dbEntryData;

          dbEntry = new aiagallery.dbif.ObjVisitors(visitor.id);

          // Make sure this user exists 
          if (dbEntry.getBrandNew())
          {
            // User does not exist, bad id
            return;
          }

          dbEntryData = dbEntry.getData();

          // Notification settings
          dbEntryData.updateOnAppComment = intValue;
          dbEntryData.updateOnAppLike = intValue;
          dbEntryData.updateOnAppDownload = intValue;

          dbEntry.put();
        }
      );


      return true; 
    },
    
    /**
     * Check to ensure a name is valid. A name must be:
     * 1. Unique
     * 2. Name is between 2 and 30 characters
     * 3. Name cannot be 'guest' or 'admin' or 'administrator'
     *    or variations. 
     *
     * @param myId {String}
     *   The ObjVisitor key field (id)
     *
     * @param name {String} 
     *   The username in question
     *
     * @param name {Map} 
     *   The a map contaning the displayName in question 
     *
     * @return {Error} 
     *   Return an error if the name is invalid.
     */
    __checkName : function(myId, name, error)
    {
      var              resultList;
      var              criteria;

      // Ensure name is lowercase
      name = name.toLowerCase(); 
      
      // Ensure name is within length range
      if(name.length <= 2 || name.length > 30)
      {
        // Name is not valid return error
        error.setCode(2);
        error.setMessage("Display name must be between 2 and 30 characters.");
        throw error;        
      }
      
      criteria = 
        {
          type  : "element",
          field : "displayName",
          value : name
        }; 
        
      // Check to ensure name is unique
      resultList = 
        liberated.dbif.Entity.query("aiagallery.dbif.ObjVisitors", 
                                    criteria);
                              
      // Check if name is unique                              
      if (resultList.length != 0 && resultList[0].id != myId)
      {
        // Name is not valid return error
        error.setCode(2);
        error.setMessage("The displayname you specified: \"" + name +
                       "\" is already in use. Please select a different one."); 
        throw error;
      }  
      
      // Check if name is allowed
      if (qx.lang.Array.contains(
            aiagallery.dbif.Constants.unallowedNames, 
            name))
      {
        // Name is not valid return error
        error.setCode(2);
        error.setMessage("The displayname you specified: \"" + name +
                       "\" is a restricted username."
                       + " Please select a different one."); 
        throw error;
      }

      // Name is valid 
      return; 
    },

    /**
     * Update apps in the cache that use a now defunct user name
     *
     * @param oldName {String}
     *   The Old name of the user 
     *
     * @param newName {String} 
     *   The user's new name
     */
    __updateNameInCache : function(oldName, newName)
    {
      var    MemcacheServiceFactory;
      var    syncCache;
      var    homeRibbonMap;
      var    i; 

      // If we're on App Engine we can use java code if not do not cache
      switch (liberated.dbif.Entity.getCurrentDatabaseProvider())
      {
      case "appengine":
          MemcacheServiceFactory = Packages.com.google.appengine.api.memcache.MemcacheServiceFactory;
          syncCache = MemcacheServiceFactory.getMemcacheService();
          //syncCache.setErrorHandler(ErrorHandlers.getConsistentLogAndContinue(Level.INFO));
          homeRibbonMap = syncCache.get(-1); // read from cache, -1 is magic number to get homeRibbonData
          if (homeRibbonMap == null) {
            // Nothing to do
            return; 
          } else {
            // This is the map containing the home ribbon data
            // The map is stored as a JSON string so convert it and then send it back
            homeRibbonMap = JSON.parse(homeRibbonMap);
               
            // Look at every app in the map and switch to new name if we need to
            for (i = 0; i < homeRibbonMap.Featured.length; i++)
            {
              if(homeRibbonMap.Featured[i].displayName == oldName)
              {
                homeRibbonMap.Featured[i].displayName = newName; 
              }
            }
            for (i = 0; i < homeRibbonMap.Newest.length; i++)
            {
              if(homeRibbonMap.Newest[i].displayName == oldName)
              {
                homeRibbonMap.Newest[i].displayName = newName; 
              }
            }
            for (i = 0; i < homeRibbonMap.MostLiked.length; i++)
            {
              if(homeRibbonMap.MostLiked[i].displayName == oldName)
              {
                homeRibbonMap.MostLiked[i].displayName = newName; 
              }
            }

            // All done place it back in the cache 
            // Convert map to a JSON string and save that
            var serialMap = JSON.stringify(homeRibbonMap);

            // I know I am in appengine code when this if clause executes.
            // Create a Java date object and add one day to set
            //  the expiration time
            var calendarClass = java.util.Calendar;
            var date = calendarClass.getInstance();  
            date.add(calendarClass.DATE, 1); 

            var expirationClass = com.google.appengine.api.memcache.Expiration;
            var expirationDate = expirationClass.onDate(date.getTime());
            syncCache.put(-1, serialMap, expirationDate);

          }

          break;

      default:
        // We are not using appengine
        break; 
      }

    }
  }
});
