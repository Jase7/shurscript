
function Quotes() {

	this.id = arguments.callee.name;
	this.name = "Notificador de citas o menciones";
	this.author = "xusoo";
	this.version = "0.2";
	this.description = "Avisará al usuario cada vez que alguien le cite en un post, mostrando alertas y un listado de las ultimas citas no leídas.";
	this.enabledByDefault = true;

	var helper = new ScriptHelper(this.id);
	
	/* Estilos propios del módulo */
	GM_addStyle(".notifications {cursor: pointer; text-align: center; padding: 7px 15px; width: 40px; background: #CECECE; color: gray; font-size: 24pt;}");
	GM_addStyle(".notifications.unread {background: #CC3300; color: white;}");
	GM_addStyle(".notifications.unread:hover {background: #E64D1A; color: white;}");
	GM_addStyle(".notifications sup {font-size: 10px;}");
	GM_addStyle("#notificationsBox {background: #FFF;border: 1px solid #C30;position: absolute;display: none;box-shadow: 0 2px 4px -2px;right: 11px;}");
	GM_addStyle("#notificationsBox #notificationsList{overflow: auto;max-height: 380px;min-height: 83px;width: 340px;}");
	GM_addStyle("#notificationsBox:after, #notificationsBox:before {bottom: 100%;border: solid transparent;content: ' ';height: 0;width: 0;position: absolute;pointer-events: none;}");
	GM_addStyle("#notificationsBox:after {border-color: rgba(255, 255, 255, 0);border-bottom-color: #fff;border-width: 10px;left: 92%;margin-left: -10px;}");
	GM_addStyle("#notificationsBox:before {border-color: rgba(204, 51, 0, 0);border-bottom-color: #CC3300;border-width: 11px;left: 92%;margin-left: -11px;}");
	GM_addStyle(".notificationRow {overflow: visible; padding: 6px; font-size: 9pt; color: #444;border-bottom:1px solid lightgray;}");
	GM_addStyle(".notificationRow > div {margin-top: 2px;}");
	GM_addStyle(".notificationRow.read {color: #AAA !important;}");
	GM_addStyle(".notificationRow.read a {color: #888 !important;}");
	GM_addStyle(".notificationRow:hover {background: #eee;}");
	GM_addStyle("#noNotificationsMessage {text-align: center; line-height: 83px; font-size: 12pt; color: #646464;}");
	GM_addStyle("#notificationsListButtons td {background: #CC3300;color: white;cursor: pointer;font-size: 10pt;height: 30px;line-height: 30px;text-align: center;border-right: 1px solid white;}");
	GM_addStyle("#notificationsListButtons td:last-child {border: none;}");
	GM_addStyle("#notificationsListButtons td:hover {background: #E64D1A;}");
	GM_addStyle("#notificationsListButtons {width: 100%;}");

	/* Variables globales del módulo */	
	var currentStatus = "QUERY"; //QUERY - Obteniendo datos, OK - Datos obtenidos, ERROR - Error al obtener los datos
	var notificationsUrl;
	var refreshEvery;// = 1 * 60 * 1000; //1 minuto
	var ajax;
	
	var lastUpdate; //Ultima actualizacion - Config. guardada en el navegador
	var lastReadQuote;
	var lastQuotesJSON; //Lista de notificaciones no leidas en formato JSON - Config. guardada en el navegador
	var showAlerts; //Mostrar o no alertas cuando lleguen nuevas notificaciones
	var mentionsToo;
	
	var arrayQuotes;
	var notificationsCount;
	var notificationsBox;
	var notificationsList;
	var notificationsListButtons;
	
	var originalTitle = document.title; //Para cambiar el titulo de la pagina con el numero de notificaciones
	
			
	this.load = function initialize() {

		encodedUsername = "";
		for (var i = 0; i < username.length; i++) {
			if (username.charCodeAt(i) > 255) {
				encodedUsername += "\\" + username.charCodeAt(i);
			} else {
				encodedUsername += username.charAt(i);
			}
		}	
		
		notificationsUrl = "http://www.forocoches.com/foro/search.php?do=process&query=" + escape(encodedUsername)"-288&titleonly=0&showposts=1";
		lastUpdate  = helper.getValue("LAST_QUOTES_UPDATE");
		lastReadQuote = helper.getValue("LAST_READ_QUOTE");
		lastQuotesJSON = helper.getValue("LAST_QUOTES");
		arrayQuotes = new Array();
		if (lastQuotesJSON) {
		    try {
			    arrayQuotes = JSON.parse(lastQuotesJSON);
		    } catch(e){
			    console.log("Error parsing JSON");
			    helper.deleteValue("LAST_QUOTES");
		    }
		}
		
		showAlerts = helper.getValue("SHOW_ALERTS", true);	
		mentionsToo = helper.getValue("MENTIONS_TOO", true);
		
		refreshEvery = helper.getValue("REFRESH_EVERY", 2);
		if (refreshEvery != 'off') {
			refreshEvery = parseInt(refreshEvery);
			if (refreshEvery.toString() == 'NaN') {
				refreshEvery = 2;
				helper.deleteValue("REFRESH_EVERY");
			}
		}
		
		createNotificationsBox();
		showNotifications();
				
	}
	
	
	/**
	 * Mostramos el contador de notificaciones
	 */
	function showNotifications() {

		//creamos la celda de notificaciones
		jQuery(".page table td.alt2[nowrap]").first().parent().append('<td style="padding: 0px;" class="alt2"><div class="notifications">0</div></td>');
		jQuery('.notifications').click(function() {
			if (currentStatus == "ERROR" || (!lastUpdate || Date.now() - parseFloat(lastUpdate) > (60 * 1000))) { //La actualizacion manual hay que esperar un minuto minimo
				updateNotifications();			
			}
			showNotificationsBox();
		});
	
		//comprobamos (si procede) nuevas notificaciones
		if (refreshEvery != 'off' && page != "/search.php" && (!lastUpdate || Date.now() - parseFloat(lastUpdate) > (refreshEvery * 60 * 1000))) {
			//Volvemos a actualizar
		    updateNotifications(true);
		} else {
			//Usamos las ultimas citas guardadas	    
		    populateNotificationsBox(arrayQuotes);
		    
		    currentStatus = "OK";
		}
	}
	
	function updateNotifications(firstLoad) {
		firstLoad = typeof firstLoad != 'undefined' ? firstLoad : false;
		
		jQuery('.notifications').html("...");
	    currentStatus = "QUERY";

	    ajax = new XMLHttpRequest();
		ajax.onreadystatechange= function() {
			if (ajax.readyState == 4 && ajax.statusText == "OK") {	        
		        lastUpdate = Date.now();
	
		        var documentResponse = jQuery.parseHTML(ajax.responseText);
		        var citas = jQuery(documentResponse).find("#inlinemodform table[id*='post']");
		        if (citas.length == 0) {
		        
		        	if (ajax.responseText.indexOf("debes estar registrado o identificado") != -1) {
			            currentStatus = "ERROR";
			            var notificationsDiv = jQuery(".notifications");
					    notificationsDiv.attr("title", "Ha ocurrido un error al cargar las notificaciones. Contacta con los desarrolladores en el hilo oficial del Shurscript (ForoCoches).");
					    notificationsDiv.html("X");
			            return;
		            }
		
		            var tooManyQueriesError = jQuery(documentResponse).find(".page li").text();
		            //Hemos recibido un error debido a demasidas peticiones seguidas. Esperamos el tiempo que nos diga ilitri y volvemos a lanzar la query.
		            if (tooManyQueriesError && !firstLoad) {
		                tooManyQueriesError = tooManyQueriesError.substring(tooManyQueriesError.indexOf("aún") + 4);
		                var secondsToWait = tooManyQueriesError.substring(0, tooManyQueriesError.indexOf(" "));
		                var remainingSeconds = parseInt(secondsToWait) + 1;
		                var timer = setInterval(function() {
		                    if (remainingSeconds > 0)
		                        setNotificationsCount("...<sup>" + (remainingSeconds--) + "</sup>");
		                    else {                    
		                        updateNotifications();
		                        clearInterval(timer);
		                    }
		                }
		                , 1000);
		                return;
		            } else if (firstLoad && arrayQuotes.length > 0) {
			            //Si en la primera carga falla, no dejamos esperando al usuario
					    populateNotificationsBox(arrayQuotes);
						//setNotificationsCount(arrayQuotes.length);
					    
					    currentStatus = "OK";
		
					    return;
		            }
		            
		            
		        }        
		            
		        newQuotes = new Array();
		        var cita;
		        if (lastReadQuote) { //Contamos las citas no leídas hasta la última que tenemos guardada
		            for (var i = 0; i < citas.length; i++) { 
		            	cita = new Cita(citas[i], false);
		                if (lastReadQuote == cita.postLink) {
		                    break;
		                } else {
		                	if (mentionsToo || isQuote(cita)) {
			                	newQuotes.push(cita);
			                }
		                }
		            }
		        }
		 
		        if (citas.length > 0) {
		        	lastReadQuote = new Cita(citas[0]).postLink;
		        	helper.setValue("LAST_READ_QUOTE", lastReadQuote);
		        }
		
		        	    
			    //Mergeamos las nuevas, las antiguas y hasta llegar a 10 citas, lo rellenamos con notificaciones ya leidas
			    var unreadQuotes = [];
			    var readQuotes = [];
			    
		        arrayQuotes = newQuotes.concat(arrayQuotes);
		        for (var i = 0; i < arrayQuotes.length; i++) {
			        if (!arrayQuotes[i].read) {
			        	unreadQuotes.push(arrayQuotes[i]);
			        } else {
			        	readQuotes.push(arrayQuotes[i]);
				    }
		        }
		        
		        arrayQuotes = unreadQuotes.concat(readQuotes.slice(0, 10 - unreadQuotes.length)); //No leídas + Leidas hasta llegar a 10 citas maximo. Si hay 3 no leidas, se rellenaran con 7 leidas. Si hay 15 no leidas, se veran las 15 pero ninguna leída.
		        
		        lastQuotesJSON = JSON.stringify(arrayQuotes); //Formateamos a JSON para guardarlo
	        	helper.setValue("LAST_QUOTES_UPDATE", Date.now().toString());
	        	helper.setValue("LAST_QUOTES", lastQuotesJSON);
	        	
	        	
		        populateNotificationsBox(arrayQuotes);
		    
		        currentStatus = "OK";
		        
		        
		        //Mensajes de alerta para el usuario
		        if (showAlerts && firstLoad) {
			        if (newQuotes.length == 1) {
				        cita = newQuotes[0];
				        bootbox.dialog({message:"El usuario <b>" + cita.userName + "</b> te ha citado en el hilo <b>" + cita.threadName + "</b><p><br></p><i>" + cita.postText + "</i><p><br></p>¿Quieres ver el post ahora?", 
							        	buttons:[{
											"label" : "Ya leída",
											"className" : "btn-default",
											"callback": function() {
													markAllAsRead();
												}
											}, {
											"label" : "Más tarde",
											"className" : "btn-default"
											}, {
											"label" : "Abrir post",
											"className" : "btn-default",
											"callback": function() {
													markAsRead(cita);
													window.open(cita.postLink, "_self");
												}
											}, {
												"label" : "En nueva ventana",
												"className" : "btn-primary",
												"callback": function() {
														markAsRead(cita);
														window.open(cita.postLink, "_blank");
													}
											}]
				        	});
			        } else if (newQuotes.length > 1) {
			        	bootbox.dialog({message:"Tienes <b>" + newQuotes.length + " citas nuevas</b> en el foro ¿Quieres verlas ahora?", 
							        	buttons:[{
											"label" : "Ya leídas",
											"className" : "btn-default",
											"callback": function() {
													markAllAsRead();
												}
											}, {
											"label" : "Más tarde",
											"className" : "btn-default"
											}, {
											"label" : "Ver lista",
											"className" : "btn-default",
											"callback": function() {
													$("html, body").animate({ scrollTop: 0 }, "slow");
													showNotificationsBox();
												}
											}, {
												"label" : "Abrir todas en pestañas",
												"className" : "btn-primary",
												"callback": function() {
														markAllAsRead();
														newQuotes.forEach(function(cita){
															window.open(cita.postLink, "_blank");
														});
													}
											}]
				        	});
	
			        }
				}
			}
		};
		
		ajax.open("GET", notificationsUrl, true);
		ajax.send();
			
	  
	}
	
	function setNotificationsCount(count) {
	    var notificationsDiv = jQuery(".notifications");
	    if (count > 0) {
	    	
	    	document.title = "(" + count + ") - " + originalTitle;
	    	
		    notificationsDiv.attr("title", "Tienes " + count + " " + (count == 1 ? "notificación no leída" : "notificaciones no leídas"));
	        notificationsDiv.addClass("unread");
	    } else {
	    	
	    	document.title = originalTitle;
	    
		    notificationsDiv.attr("title", "No tienes ninguna notificación nueva");
	        notificationsDiv.removeClass("unread");
	    }
	    notificationsCount = count;
	    notificationsDiv.html(count);
	    
	    
	    
	}
	
	function createNotificationsBox() {
		notificationsBox = jQuery("<div id='notificationsBox'/>");
		notificationsList = jQuery("<div id='notificationsList'/>");
	
		$(document.body).append(notificationsBox);
		notificationsBox.append(notificationsList);
		
		$(document).mouseup(function (e) {	
		    if (notificationsBox.css("display") == "block" && !notificationsBox.is(e.target) //No es nuestra caja
		        && notificationsBox.has(e.target).length === 0) { //Ni tampoco un hijo suyo
		        notificationsBox.hide(); //Cerramos la caja
		        e.stopImmediatePropagation();
		        e.stopPropagation();
		        e.preventDefault();
		    }
		});
					
	}
	
	function showNotificationsBox() {
		notificationsBox.css("top", jQuery(".notifications").offset().top + jQuery(".notifications").height() + 20);	
		notificationsBox.show();
	}
	
	function populateNotificationsBox(array) {
		notificationsList.html('<div id="noNotificationsMessage">No tienes ninguna notificación</div>'); //Vaciamos
		var count = 0;
		for (var i = 0; i < array.length; i++) {
			addToNotificationsBox(array[i]);
			if (!array[i].read) {
				count++;
			}
		}
		setNotificationsCount(count);
		
		if (!notificationsListButtons) {
			notificationsListButtons = jQuery("<table id='notificationsListButtons' border='0' cellspacing='0'><tr></tr></table>");
			
			var markAsReadButton = jQuery("<td title='Marcar todas las citas como leídas'/>");
			markAsReadButton.html("Marcar como leídas");
			markAsReadButton.click(function(){
				markAllAsRead();
			});
			notificationsListButtons.append(markAsReadButton);
			
			if (helper.getValue("OPEN_IN_TABS_BUTTON", true)) {
				var openInTabsButton = jQuery("<td title='Abrir todas las citas no leídas en diferentes pestañas'/>");
				openInTabsButton.html("Abrir en pestañas");
				openInTabsButton.click(function(){
					arrayQuotes.forEach(function(cita){
						if (!cita.read) {
							window.open(cita.postLink, "_blank");
						}
					});
					markAllAsRead();
				});
				notificationsListButtons.append(openInTabsButton);
			}
			
			notificationsBox.append(notificationsListButtons);
		}
		
		if (count > 0) {
			notificationsListButtons.show();
		} else {
			notificationsListButtons.hide();
		}
	}
	
	function markAllAsRead() {
		for(var i = 0; i < arrayQuotes.length; i++) {
			arrayQuotes[i].read = true;
		}

/* 		setNotificationsCount(0); */
		populateNotificationsBox(arrayQuotes);
		lastQuotesJSON = JSON.stringify(arrayQuotes);
		helper.setValue("LAST_QUOTES", lastQuotesJSON);
		notificationsBox.hide();
	}
	
	function addToNotificationsBox(cita) {
		jQuery("#noNotificationsMessage").hide();
		var row = jQuery("<div class='notificationRow " + (cita.read ? "read" : "") + "'><div><b>El usuario <a href='" + cita.userLink + "'>" + cita.userName + "</a> te ha citado</div><div><a href='" + cita.threadLink + "'>" + cita.threadName + "</a></b></div><div></div></div>");
		var link = jQuery("<a href='" + cita.postLink + "' style='color:#444;'>" + cita.postText + "</a>");
		
		if (!cita.read) {
			link.mousedown(function(e) { 
				if (e.which != 3) {
					if (!cita.read) {
						$(this).parent().parent().addClass("read");
						markAsRead(cita);
					}
					$(this).off("mousedown");	
				}
			});
		}
	
		link.appendTo(row.find("div").get(2));
	
		notificationsList.append(row);
	}
	
	function markAsRead(cita) {
		
		cita.read = true;
		
		lastQuotesJSON = JSON.stringify(arrayQuotes);
    	helper.setValue("LAST_QUOTES", lastQuotesJSON);
    	
    	setNotificationsCount(notificationsCount - 1);
	}
	
	
	function Cita(el, read) {
		
		var postElement = $(el).find(".smallfont > em > a");
		this.postLink = postElement.attr("href");
		this.postText = postElement.text().replace(/</g, '&lt;');
		this.postID = this.postLink.match(/#post([\d]*)/)[1];
		
		var threadElement = $(el).find(".alt1 > div > a > strong");
		this.threadLink = threadElement.parent().attr("href");
		this.threadName = threadElement.text();
		
		var userElement = $(el).find(".smallfont > a");
		this.userLink = userElement.attr("href");
		this.userName = userElement.text();
		
		this.read = read;
		
	}
	
	
	//Llamada SINCRONA para parsear un post y detectar si es una cita real o solo una mención.
	function isQuote(cita) {
		var result = false;
		ajax = new XMLHttpRequest();
		ajax.onreadystatechange= function() {
			if (ajax.readyState == 4 && ajax.statusText == "OK") {	        
		        var documentResponse = jQuery.parseHTML(ajax.responseText);
		        var postContent = jQuery(documentResponse).find("#post_message_" + cita.postID).text();
		        var usernameRegexReady = username.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&"); //Escapar caracteres reservador de las regex;
		        if (postContent.match(RegExp("Originalmente Escrito por " + usernameRegexReady, "i"))) {
			        result = true;
		        }
			}
		};
		
		ajax.open("GET", cita.postLink, false);
		ajax.send();
		return result;
	}
	
	this.getPreferences = function() {
		var preferences = new Array();
		
		preferences.push(new BooleanPreference("SHOW_ALERTS", true, "Mostrar una alerta en el navegador cada vez que llegue una nueva notificación"));
		preferences.push(new BooleanPreference("MENTIONS_TOO", true, "Notificar también las menciones, no solo las citas (Si se desactiva puede ralentizar la recuperación de las notificaciones)"));
		
		unsafeWindow.chromeTabsWarning = function() {
			bootbox.alert("<p>Si al darle al botón de Abrir en pestañas solo os abre una pestaña y no todas, es porque tenéis bloqueados los pop-ups para Forocoches, tendréis que permitirselos para poder abrir las notificaciones en pestañas.</p>\
			<p>Pero eso no es todo, Google Chrome por norma general solo te abrirá el primer enlace en una nueva pestaña. El resto te los abrirá en ventanas independientes.</p>\
			<p>Cómo sabemos que esto puede ser molesto y no existe solución por nuestra parte, en el caso que de verdad quieras usar esta funcionalidad de abrir las notificaciones en pestañas, \
			deberás instalar <a target='_blank' href='https://chrome.google.com/webstore/detail/one-window/papnlnnbddhckngcblfljaelgceffobn/related'>esta extensión</a> que aunque no es una solución muy limpia, hace su función.</p>\
			<p>Para evitar confusiones, decir que esto no tiene nada que ver con abrir una única notificación en una nueva pestaña, eso funciona perfectamente. El problema descrito solo aplica cuando se abre más de una a la vez.</p> <p>Disculpa las molestias</p>");
		};
		preferences.push(new BooleanPreference("OPEN_IN_TABS_BUTTON", true, "Mostrar botón en la lista de notificaciones para abrir las no leídas en pestañas. <b style='text-decoration:underline;' onclick='chromeTabsWarning()'>Leer usuarios de Chrome</b>"));
		
		var refreshEveryOptions = [new RadioOption("2", "Cada 2 minutos"), new RadioOption("10", "Cada 10 minutos"), new RadioOption("30", "Cada 30 minutos"), new RadioOption("off", "Manualmente", "Haciendo clic en el contador de notificaciones")];
		preferences.push(new RadioPreference("REFRESH_EVERY", "2", refreshEveryOptions, "Buscar citas:"));		
		
		return preferences;
	};
}
