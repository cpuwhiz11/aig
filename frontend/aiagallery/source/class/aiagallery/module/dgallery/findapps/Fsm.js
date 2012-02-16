/**
 * Copyright (c) 2011 Derrell Lipman
 * Copyright (c) 2011 Reed Spool
 * 
 * License:
 *   LGPL: http://www.gnu.org/licenses/lgpl.html 
 *   EPL : http://www.eclipse.org/org/documents/epl-v10.php
 */

/*
require(aiagallery.module.dgallery.appinfo.AppInfo)
 */

/**
 * Gallery "find apps" page finite state machine
 */
qx.Class.define("aiagallery.module.dgallery.findapps.Fsm",
{
  type : "singleton",
  extend : aiagallery.main.AbstractModuleFsm,

  members :
  {
    buildFsm : function(module)
    {
      var fsm = module.fsm;
      var state;
      var trans;

      // ------------------------------------------------------------ //
      // State: Idle
      // ------------------------------------------------------------ //

      /*
       * State: Idle
       *
       * Actions upon entry
       *   - if returning from RPC, display the result
       */

      state = new qx.util.fsm.State("State_Idle",
      {
        "context" : this,

        "onentry" : function(fsm, event)
        {
          // Did we just return from an RPC request?
          if (fsm.getPreviousState() == "State_AwaitRpcResult")
          {
            // Yup.  Display the result.  We need to get the request object
            var rpcRequest = this.popRpcRequest();

            // Call the standard result handler
            var gui = aiagallery.module.dgallery.findapps.Gui.getInstance();
            gui.handleResponse(module, rpcRequest);

            // Dispose of the request
            if (rpcRequest.request)
            {
              rpcRequest.request.dispose();
              rpcRequest.request = null;
            }
          }
        },

        "events" :
        {
          "changeSelection" :
          {
            // When a finder selection is made in the first list
            "browse0" : "Transition_Idle_to_AwaitRpcResult_via_browse",

            // When a finder selection is made in the second list
            "browse1" : "Transition_Idle_to_AwaitRpcResult_via_browse",

            // When a finder selection is made in the third list
            "browse2" : "Transition_Idle_to_AwaitRpcResult_via_browse"
          },
          
          // click on app title or image
          "viewApp" : "Transition_Idle_to_Idle_via_viewApp",

          "execute" :
          {
            // click on the Search button in Advanced Search
            "butAdvSearch"  : "Transition_Idle_to_AwaitRpcResult_via_advsearch",

            // click on the Search button in Text Search
            "butTextSearch" : "Transition_Idle_to_AwaitRpcResult_via_textsearch"
          },
          
          // When we get an appear event, retrieve the category tags list. We
          // only want to do it the first time, though, so we use a predicate
          // to determine if it's necessary.
          "appear"    :
          {
            "main.canvas" : 
              qx.util.fsm.FiniteStateMachine.EventHandling.PREDICATE
          },

          // When we get a disappear event
          "disappear" :
          {
            "main.canvas" : "Transition_Idle_to_Idle_via_disappear"
          }
        }
      });

      // Replace the initial Idle state with this one
      fsm.replaceState(state, true);


      // The following transitions have a predicate, so must be listed first

      /*
       * Transition: Idle to Idle
       *
       * Cause: "appear" on canvas
       *
       * Action:
       *  If this is the very first appear, retrieve the category list.
       */

      trans = new qx.util.fsm.Transition(
        "Transition_Idle_to_AwaitRpcResult_via_appear",
      {
        "nextState" : "State_AwaitRpcResult",

        "context" : this,

        "predicate" : function(fsm, event)
        {
          // Have we already been here before?
          if (fsm.getUserData("noUpdate"))
          {
            // Yup. Don't accept this transition and no need to check further.
            return null;
          }
          
          // Prevent this transition from being taken next time.
          fsm.setUserData("noUpdate", true);
          
          // Accept this transition
          return true;
        },

        "ontransition" : function(fsm, event)
        {
          // Issue the remote procedure call to get the list of category tags.
          var request =
            this.callRpc(fsm,
                         "aiagallery.features",
                         "getCategoryTags",
                         []);

          // When we get the result, we'll need to know what type of request
          // we made.
          request.setUserData("requestType", "getCategoryTags");
        }
      });

      state.addTransition(trans);


      // Remaining transitions are accessed via the jump table

      /*
       * Transition: Idle to Idle
       *
       * Cause: "changeSelection" on one of the Browse finder's lists
       *
       * Action:
       *  Initiate a request for the list of  matching applications.
       */

      trans = new qx.util.fsm.Transition(
        "Transition_Idle_to_AwaitRpcResult_via_browse",
      {
        "nextState" : "State_AwaitRpcResult",

        "context" : this,

        "ontransition" : function(fsm, event)
        {
          var             i;
          var             browse;
          var             browse0;
          var             browse1;
          var             browse2;
          var             criteria;
          var             criterium;
          var             and;
          var             request;
          var             selection;

          // Create an array of the lists
          browse0 = fsm.getObject("browse0");
          browse1 = fsm.getObject("browse1");
          browse2 = fsm.getObject("browse2");
          browse = [ browse0, browse1, browse2 ];

          // Determine on which browse list we received the event
          var friendly = fsm.getFriendlyName(event.getTarget());
          
          // Clear lists beyond this one
          switch(friendly)
          {
          case "browse0":
            browse1.removeAll();
            // fall through
            
          case "browse1":
            browse2.removeAll();
            // fall through
            
          case "browse2":
            // nothing to do
          }

          // We're building a series of AND criteria
          criteria =
            {
              type     : "op",
              method   : "and",
              children : []
            };
          
          // Find the selection in each list and generate a criterium
          for (i = 0; i < browse.length; i++)
          {
            // Get this list's selection
            selection = browse[i].getSelection();
            
            // If there's a selection...
            if (selection.length > 0)
            {
              // Create a criterum element
              criterium = 
                {
                  type  : "element", 
                  field : "tags", 
                  value : selection[0].getLabel()
                };
              
              // Add it to the list of criteria being ANDed
              criteria.children.push(criterium);
            }
          }

          // Issue the remote procedure call to execute the query
          request =
            this.callRpc(fsm,
                         "aiagallery.features",
                         "appQuery",
                         [
                           criteria
                         ]);

          // When we get the result, we'll need to know what type of request
          // we made.
          request.setUserData("requestType", "appQuery");
          
          // We'll also need to know where the request originated
          request.setUserData("querySource", friendly);

        }
      });

      state.addTransition(trans);


      /*
       * Transition: Idle to Awaiting RPC Result
       *
       * Cause: "Search" button pressed in Text Search
       *
       * Action:
       *  Initiate a request for the list of  matching applications.
       */
        
      trans = new qx.util.fsm.Transition(
        "Transition_Idle_to_AwaitRpcResult_via_textsearch",
      {
        "nextState" : "State_AwaitRpcResult",

        "context" : this,

        "ontransition" : function(fsm, event)
        {
          var             i;
          var             criteria;
          var             keywordString;
          var             request;
          var             criteriaArray;
          
          // We're building a series of AND criteria
          criteria =
            {
              type     : "op",
              method   : "and",
              children : []
            };
          
          // Retrieve the requested search words
          keywordString = fsm.getObject("txtTextSearch").getValue();
          
          // Issue the remote procedure call to execute the query
          request =
            this.callRpc(fsm,
                         "aiagallery.features",
                         "intersectKeywordAndQuery",
                         [
                           {
                             criteria : criteria,
                             keywordString : keywordString,
                             requestedFields : null,
                             queryFields : null // not yet implemented
                           }
                         ]);

          // When we get the result, we'll need to know what type of request
          // we made.
          request.setUserData("requestType", "intersectKeywordAndQuery");
        }
      });

      state.addTransition(trans);

      /*
       * Transition: Idle to Awaiting RPC Result
       *
       * Cause: "Search" button pressed in Advanced Search
       *
       * Action:
       *  Initiate a request for the list of  matching applications.
       */
        
      trans = new qx.util.fsm.Transition(
        "Transition_Idle_to_AwaitRpcResult_via_advsearch",
      {
        "nextState" : "State_AwaitRpcResult",

        "context" : this,

        "ontransition" : function(fsm, event)
        {
          var             i;
          var             browse;
          var             browse0;
          var             browse1;
          var             browse2;
          var             criteria;
          var             criterium;
          var             keywordString = "";
          var             and;
          var             request;
          var             criteriaArray;
          
          // Determine on which widget we received the event
          var friendly = fsm.getFriendlyName(event.getTarget());
          
          // Clear all Finder lists
          fsm.getObject("browse1").removeAll();
          fsm.getObject("browse2").removeAll();

          // Don't clear the Categories one, just blank its selection
          fsm.getObject("browse0").resetSelection();
            
          // We're building a series of AND criteria
          criteria =
            {
              type     : "op",
              method   : "and",
              children : []
            };
          
          // Aggregating all of the form information for the search.

          // Get all of the criteria from the wrapper
          criteriaArray = fsm.getObject("searchCriteria").getUserData("array");
          
          // For every criteria that wasn't deleted, add appropriate
          // criteria as the children of the search criteria object
          criteriaArray.forEach(
            function(criteriaObj)
            {
              var myAttr;
              var myQual;
              var myVal;
              var myFilterOp = "="; // default '='
              
              // Don't do anything with objects where "deleted" is true,
              // They were deleted in the GUI, and should be disregarded.
              if (!criteriaObj.deleted)
              {
                // Gather all info for this criterium
                myAttr = criteriaObj.attributeBox.getSelection()[0].getModel();
//              myQual = criteriaObj.qualifierBox.getSelection()[0].getModel();
                myVal = criteriaObj.valueBox.getValue();
                
                // Build object with everything we know so far, to be added onto
                criterium = 
                  {
                    type  : "element",
                    field : null
                  };
                
                // Pick the appropriate filterOp, 
                switch (myAttr)
                {
                case "likesGT":
                  criterium["filterOp"] = ">";
                  break;
                  
                case "likesLT":
                  criterium["filterOp"] = "<";
                  break;
                  
                case "likesEQ":             
                  // use default "=" filterOP
                  break;
                                    
                case "downloadsGT":
                  criterium["filterOp"] = ">";
                  break;
                                    
                case "downloadsLT":
                  criterium["filterOp"] = "<";
                  break;
                                    
                case "downloadsEQ":         
                  // use default "=" filterOp
                  break;
                }
                
                // Value needs to be of the correct type per the field being
                // queried on, but everything comes in as text
                // Also set up criterium.field correctly
                switch (myAttr)
                {
                  // These are keyword search items, and will not set
                  // criterium.field, thus won't be added to the query

                  // FIX: Right now all text fields are searched every time
                  // this needs to be fixed in the future.
                case "alltext":
                case "title":
                case "description":
                  keywordString = keywordString + " " + myVal;
                  break;
                  
                case "tags":
                  criterium["field"] = "tags";
                  criterium["value"] = myVal;
                  break;
                  
                case "likesGT":
                case "likesLT":
                case "likesEQ":
                  criterium["field"] = "numLikes";
                  criterium["value"] = parseInt(myVal, 10);
                  break;
                  
                case "downloadsGT":
                case "downloadsLT":
                case "downloadsEQ":
                  criterium["field"] = "numDownloads";
                  criterium["value"] = parseInt(myVal, 10);
                  break;
                }
                
                // If this is a search criteria, not a keyword search item...
                if (criterium["field"] !== null)
                {
                  // Add it to the list of criteria being ANDed
                  criteria.children.push(criterium);
                }
              }
            });
          
          
          // Issue the remote procedure call to execute the query
          request =
            this.callRpc(fsm,
                         "aiagallery.features",
                         "intersectKeywordAndQuery",
                         [
                           {
                             criteria : criteria,
                             keywordString : keywordString,
                             requestedFields : null,
                             queryFields : null // not yet implemented
                           }
                         ]);

          // When we get the result, we'll need to know what type of request
          // we made.
          request.setUserData("requestType", "intersectKeywordAndQuery");
          
          // And where that request came from.
          request.setUserData("querySource", friendly);

        }
      });

      state.addTransition(trans);

      /*
       * Transition: Idle to Idle
       *
       * Cause: An item is selected from the search results
       *
       * Action:
       *  Create (if necessary) and switch to an application-specific tab
       */

      trans = new qx.util.fsm.Transition(
        "Transition_Idle_to_Idle_via_viewApp",
      {
        "nextState" : "State_Idle",

        "context" : this,

        "ontransition" : function(fsm, event)
        {
          var             item = event.getData();
          
          // Add a module for the specified app
          aiagallery.module.dgallery.appinfo.AppInfo.addAppView(item.uid, 
                                                                item.title);
        }
      });

      state.addTransition(trans);


      /*
       * Transition: Idle to Idle
       *
       * Cause: "disappear" on canvas
       *
       * Action:
       *  Stop our timer
       */

      trans = new qx.util.fsm.Transition(
        "Transition_Idle_to_Idle_via_disappear",
      {
        "nextState" : "State_Idle",

        "context" : this,

        "ontransition" : function(fsm, event)
        {
        }
      });

      state.addTransition(trans);

      
      // ------------------------------------------------------------ //
      // State: <some other state>
      // ------------------------------------------------------------ //

      // put state and transitions here




      // ------------------------------------------------------------ //
      // State: AwaitRpcResult
      // ------------------------------------------------------------ //

      // Add the AwaitRpcResult state and all of its transitions
      this.addAwaitRpcResultState(module);


      // ------------------------------------------------------------ //
      // Epilog
      // ------------------------------------------------------------ //

      // Listen for our generic remote procedure call event
      fsm.addListener("callRpc", fsm.eventListener, fsm);
    }
  }
});
