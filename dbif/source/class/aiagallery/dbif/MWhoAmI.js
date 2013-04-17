/**
 * Copyright (c) 2011 Derrell Lipman
 * 
 * License:
 *   LGPL: http://www.gnu.org/licenses/lgpl.html 
 *   EPL : http://www.eclipse.org/org/documents/epl-v10.php
 */

qx.Mixin.define("aiagallery.dbif.MWhoAmI",
{
  construct : function()
  {
    this.registerService("aiagallery.features.whoAmI",
                         this.whoAmI,
                         []);

    this.registerService("aiagallery.features.getUserProfile",
                         this.getUserProfile,
                         []);

    this.registerService("aiagallery.features.getPublicUserProfile",
                         this.getPublicUserProfile,
                         ["user"]);
  },

  members :
  {
    /**
     * Return the user's current login information and, optionally a logout
     * URL.
     * 
     * This function will check legacy users to see if they have visited their
     * profile before we started tracking that data. It will write to the DB 
     * if it finds a user that has been to their profile, but it is currently
     * belived that they had not been. 
     */
    whoAmI : function()
    {
      var             ret;
      var             me;
      var             meData; 
      var             whoami;
      
      // Get the object indicating who we're logged in as
      whoami = this.getWhoAmI();

      // Are they logged in?
      if (!whoami )
      {
        // Nope.
        return({
                 id                : "",
                 email             : "anonymous",
                 displayName       : "",
                 isAdmin           : false,
                 logoutUrl         : "",
                 permissions       : [],
                 hasSetDisplayName : true,
                 isAnonymous       : true
               });
      }
      
      // Obtain this dude's Visitor record
      me = new aiagallery.dbif.ObjVisitors(whoami.id);
      meData = me.getData();      

      // Create the return object, initialized to a clone of whoami.
      ret =
        {
          id                : String(whoami.id),
          email             : String(whoami.email),
          displayName       : String(whoami.displayName),
          isAdmin           : whoami.isAdmin,
          logoutUrl         : (qx.lang.Type.isArray(whoami.logoutUrl)
                               ? qx.lang.Array.clone(whoami.logoutUrl)
                               : String(whoami.logoutUrl)),
          permissions       : (qx.lang.Type.isArray(whoami.permissions)
                               ? qx.lang.Array.clone(whoami.permissions)
                               : []),
          hasSetDisplayName : whoami.hasSetDisplayName,
          isAnonymous       : whoami.isAnonymous,
          checkedProfile    : meData.checkedProfile
        };

      // This is legacy code to account for users who existed befre
      // we tracked if a user had visited their account of not.
      // Do some quick checks to see if they had in fact visited their profile.
      // Do this by checking to see if some properties have been changed from
      // the default. 
      if (ret["checkedProfile"] == 0)
      {
       if(meData.showEmail == 1 ||
           meData.url == null ||
           meData.organization == null ||
           meData.bio == null ||
           meData.birthYear == null || 
           meData.birthMonth == null )
        {
          meData.checkedProfile = 1;
          me.put(); 
        }       
        else if(meData.showEmail == 1 ||
           meData.url.length != 0 ||
           meData.organization.length != 0 ||
           meData.bio.length != 0 ||
           meData.birthYear != 0 || 
           meData.birthMonth.length != 0 )
        {
          meData.checkedProfile = 1;
          me.put(); 
        } 
      }

      return ret;
    },

    /**
     * Retrun the user profile information in the form of a map.
     * This function operates similiar whoAmI, but will return more data.
     * 
     * Executing this function will update the visitor object indicating
     * the user has visited their profile. 
     * 
     * @return {Map}
     *   A map of all the user data to display in the myself module
     * 
     */ 
    getUserProfile : function()
    {

      var             ret;
      var             me;
      var             meData; 
      var             whoami;
      
      // Get the object indicating who we're logged in as
      whoami = this.getWhoAmI();
      
      // Are they logged in?
      if (! whoami)
      {
        // Nope.
        return({
                 id                : "",
                 email             : "Guest"
               });
      }
      
      // Obtain this dude's Visitor record
      me = new aiagallery.dbif.ObjVisitors(whoami.id);
      meData = me.getData();

      // Create the return object with the vistor data
      ret =
        {
          id                : String(whoami.id),
          email             : String(whoami.email),
          displayName       : String(whoami.displayName),
          hasSetDisplayName : whoami.hasSetDisplayName,
          location          : meData.location,
          bio               : meData.bio,
          birthYear         : meData.birthYear,
          birthMonth        : meData.birthMonth,
          org               : meData.organization,
          url               : meData.url,
          showEmail         : meData.showEmail,
          updateOnAppComment           : meData.updateOnAppComment,
          updateCommentFrequency       : meData. updateCommentFrequency,
          updateOnAppLike              : meData.updateOnAppLike,
          updateOnAppLikeFrequency     : meData.updateOnAppLikeFrequency, 
          updateOnAppDownload          : meData.updateOnAppDownload,
          updateOnAppDownloadFrequency : meData.updateOnAppDownloadFrequency
        };

      // By executing this function the user has visited their profile page.
      // In this case update the visitor object to reflect this
      meData.checkedProfile = 1; 
      me.put();

      return ret;

    },

   /**
    * Receive a username, search for the user and return a map
    *  of data to display on the profile page
    *
    * @param user {String}
    *  The username in question
    * 
    * @return {Map}
    *  A map of the user data to display
    * 
    */
    getPublicUserProfile : function(user, error)
    {
      var              criteria;
      var              resultList;
      var              requestedFields;
      var              profile;
      var              bFlag = false; 

      requestedFields = {
        uid         : "uid",
        owner       : "owner",
        image1      : "image1",
        title       : "title",
        displayName : "displayName"
      }; 
      
      criteria = 
        {
          type  : "element",
          field : "displayName",
          value : user
        }; 
        
      // Check to ensure name is unique
      resultList = 
        liberated.dbif.Entity.query("aiagallery.dbif.ObjVisitors", 
                                    criteria);
                              
      // Should return one and only one username     
      if (resultList.length != 1) 
      {
        error.setCode(2);
        error.setMessage("The display name you specified: \"" + user +
                         "\" cannot be found."); 

        return error;
      }
      
      // The first result if the user profile we are pulling
      profile = resultList[0];
    
      // Get all the apps this author has made
      criteria = 
        {
          type : "op",
          method : "and",
          children : 
          [
            {
              type: "element",
              field: "owner",
              value: profile.id
            },
            {
              type: "element",
              field: "status",
              value: aiagallery.dbif.Constants.Status.Active
            }
          ]
        };

      resultList =
        liberated.dbif.Entity.query("aiagallery.dbif.ObjAppData", 
                                    criteria);             

      // Add the author's name to each app
      resultList.forEach(
        function(app)
        {
          app.displayName = user || "<>";

          // Clear out unneeded fields
          aiagallery.dbif.MApps._requestedFields(app, requestedFields);

          // Remove the owner field
          delete app.owner;
        });


      // Add in a list of user authored apps 
      profile["authoredApps"] = resultList; 
 
      // Add in if the user pulling the profile has flagged 
      // this user's profile
      criteria = 
        {
          type : "op",
          method : "and",
          children : 
          [
            {
              type  : "element",
              field : "profileId",
              value : profile.id
            },
            {
              type  : "element",
              field : "visitor",
              value : this.getWhoAmI().id
            },
            {
              type  : "element",
              field : "type",
              value : aiagallery.dbif.Constants.FlagType.Profile
            }              
          ]
        };

      resultList = liberated.dbif.Entity.query("aiagallery.dbif.ObjFlags",
                                               criteria,
                                               null);

      // If we got one, and only one hit, the user pulling this profile
      // has flagged this profile in the past. 
      if (resultList.length == 1)
      {
        bFlag = true; 
      }

      // Add to profile map 
      profile["flagged"] = bFlag; 

      // Not allowed to return user id
      delete profile.id; 

      // If the user does not want to show email
      // do not return it
      if (profile.showEmail == 0)
      {
        delete profile.email;
      }

      // Do not show DOB info for now
      delete profile.birthYear;
      delete profile.birthMonth; 

      return profile;
    }

  }
});
