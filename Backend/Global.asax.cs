using System;
using System.Web.Http;
using System.Web.Routing;

namespace LargeFileUpload.Backend
{
    public class WebApiApplication : System.Web.HttpApplication
    {
        protected void Application_Start()
        {
            GlobalConfiguration.Configure(WebApiConfig.Register);
        }
    }
}
