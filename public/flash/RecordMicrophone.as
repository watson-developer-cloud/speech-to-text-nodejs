package {

  import flash.display.Sprite;
  import flash.utils.ByteArray;
  import flash.media.Microphone; 
  import flash.events.SampleDataEvent; 
  import flash.external.ExternalInterface;
  import mx.utils.Base64Encoder;

  public class RecordMicrophone extends Sprite {


    public function RecordMicrophone() {

      const BUFFER_SIZE:int = 2048;
      const INITIAL_BUFFER:int = 1024;
     
      var recording:Boolean = false;

      var mic:Microphone = Microphone.getMicrophone(); 
      mic.rate = 16; 
      mic.setSilenceLevel(0);
      mic.addEventListener(SampleDataEvent.SAMPLE_DATA, micSampleDataHandler); 
      mic.setLoopBack(false);
      mic.enableVAD = true;
       
       
      function micSampleDataHandler(event:SampleDataEvent):void  { 
        while(event.data.bytesAvailable) {
          var soundBytes:ByteArray = new ByteArray();
          while(soundBytes.length < BUFFER_SIZE) { 
            var sample:Number = event.data.readFloat();
            soundBytes.writeFloat(sample);
          }
          soundBytes.position = 0;
          soundBytes.compress();
          var b64:Base64Encoder = new Base64Encoder();
          b64.encodeBytes(soundBytes);
          ExternalInterface.call('soundRecorded', b64.toString());
        } 
      } 

    }

  }
}
